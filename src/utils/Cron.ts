import { CronJob, CronJobParams } from 'cron';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  WebhookClient
} from 'discord.js';

import ms from 'ms';

import { CronSlugs, DefaultTimezone, LogDateFormat } from '@utils/Constants';
import { ReportUtils } from '@utils/Reports';
import { client, prisma, Sentry } from '@/index';
import { pluralize } from '.';

import Logger, { AnsiColor } from '@utils/Logger';
import ConfigManager from '@managers/config/ConfigManager';
import InfractionManager, { INFRACTION_COLORS } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';
import DatabaseManager from '@managers/database/DatabaseManager';

const { runners, messages } = ConfigManager.global_config.database;

/**
 * The class responsible for handling cron jobs.
 */

export class CronUtils {
  /**
   * Starts a cron job with the given parameters
   *
   * - Tracks the cron job with Sentry
   * - Logs the start of the cron job
   * - Logs each tick of the cron job
   *
   * @param monitorSlug - The slug of the monitor
   * @param cronTime - The cron time string (timezone: {@link DefaultTimezone})
   * @param silent - Whether to suppress logs
   * @param onTick - The function to run on each tick
   */
  public static startJob(
    monitorSlug: string,
    cronTime: CronJobParams['cronTime'],
    silent: boolean,
    onTick: () => Promise<void> | void
  ): void {
    const cronJobWithCheckIn = Sentry.cron.instrumentCron(CronJob, monitorSlug);

    cronJobWithCheckIn
      .from({
        cronTime,
        timeZone: DefaultTimezone,
        onTick: async () => {
          if (!silent)
            Logger.log(monitorSlug, 'Running cron job...', {
              color: AnsiColor.Cyan
            });

          await onTick();

          if (!silent)
            Logger.log(monitorSlug, 'Successfully ran cron job.', {
              color: AnsiColor.Green
            });
        }
      })
      .start();

    Logger.log(monitorSlug, `${silent ? 'Silent ' : ''}Cron job started: ${cronTime}`, {
      color: AnsiColor.Orange
    });
  }

  /**
   * Starts the task runner responsible for removing expired infractions and tasks.
   */

  public static startTaskRunner(): void {
    return CronUtils.startJob('TASK_RUNNER', runners.tasks, true, async () => {
      await prisma.infraction.deleteMany({
        where: {
          type: 'Warn',
          AND: [{ expires_at: { not: null } }, { expires_at: { lte: Date.now() } }]
        }
      });

      const dbGuilds = await prisma.guild.findMany({
        select: { id: true, notify_unmute_action: true, tasks: { where: { expires_at: { lte: Date.now() } } } }
      });

      for (const dbGuild of dbGuilds) {
        const discordGuild = await client.guilds.fetch(dbGuild.id).catch(() => null);

        if (!discordGuild) {
          await prisma.task.deleteMany({
            where: {
              guild_id: dbGuild.id,
              expires_at: { lte: Date.now() }
            }
          });

          continue;
        }

        const config = await DatabaseManager.getGuildEntry(discordGuild.id);
        const permissions = discordGuild.members.me!.permissions;
        const banPermissions = permissions.has(PermissionFlagsBits.BanMembers);

        if (!banPermissions) {
          await prisma.task.deleteMany({
            where: {
              guild_id: discordGuild.id,
              type: 'Ban',
              expires_at: { lte: Date.now() }
            }
          });

          continue;
        }

        for (const task of dbGuild.tasks) {
          if (task.type === 'Ban') {
            await discordGuild.members.unban(task.target_id).catch(() => null);
          } else {
            const member = await discordGuild.members.fetch(task.target_id).catch(() => null);

            if (member) {
              if (
                member.communicationDisabledUntil &&
                +member.communicationDisabledUntil > Number(task.expires_at) + 10000
              ) {
                await prisma.task.update({
                  where: {
                    id: task.id
                  },
                  data: {
                    expires_at: +member.communicationDisabledUntil
                  }
                });

                continue;
              }

              const embed = new EmbedBuilder()
                .setAuthor({ name: discordGuild.name, iconURL: discordGuild.iconURL() ?? undefined })
                .setColor(INFRACTION_COLORS.Unmute)
                .setTitle(`You've been unmuted in ${discordGuild.name}`)
                .setFields([{ name: 'Reason', value: 'Mute expired based on duration.' }])
                .setTimestamp();

              if (dbGuild.notify_unmute_action) await member.send({ embeds: [embed] }).catch(() => {});
            }
          }

          await TaskManager.deleteTask({ id: task.id });

          const infraction = await InfractionManager.storeInfraction({
            id: InfractionManager.generateInfractionId(),
            guild_id: discordGuild.id,
            target_id: task.target_id,
            executor_id: client.user!.id,
            type: task.type === 'Ban' ? 'Unban' : 'Unmute',
            reason: `${task.type} expired based on duration.`,
            created_at: Date.now()
          });

          await InfractionManager.logInfraction({ config, infraction });
        }
      }
    });
  }

  /**
   * Starts the task runner responsible for disregarding reports after a certain time.
   */

  public static startReportDisregardRunner(): void {
    return CronUtils.startJob(CronSlugs.ReportDisregardRunner, runners.reports, true, async () => {
      const messageReports = await prisma.messageReport.findMany({
        where: {
          reported_at: { lte: Date.now() },
          status: 'Pending'
        }
      });

      const userReports = await prisma.userReport.findMany({
        where: {
          reported_at: { lte: Date.now() },
          status: 'Pending'
        }
      });

      for (const report of messageReports) {
        const config = await DatabaseManager.getGuildEntry(report.guild_id);

        if (report.reported_at + config.message_reports_disregard_after > Date.now()) {
          continue;
        }

        await prisma.messageReport.update({
          where: { id: report.id },
          data: { status: 'Disregarded', resolved_at: Date.now(), resolved_by: client.user!.id }
        });

        if (!config.message_reports_webhook) {
          continue;
        }

        const webhook = new WebhookClient({ url: config.message_reports_webhook });
        const log = await webhook.fetchMessage(report.id).catch(() => null);

        if (!log) {
          continue;
        }

        const primaryEmbed = log.embeds.at(log.components!.length === 1 ? 0 : 1);
        const secondaryEmbed = log.components!.length === 2 ? log.embeds.at(0) : null;

        const embed = new EmbedBuilder(primaryEmbed)
          .setColor(Colors.NotQuiteBlack)
          .setAuthor({ name: 'Message Report' });

        const disregardedButton = new ButtonBuilder()
          .setDisabled(true)
          .setLabel('Disregarded (Auto)')
          .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(disregardedButton);

        if (secondaryEmbed) {
          await webhook
            .editMessage(log.id, {
              embeds: [secondaryEmbed, embed],
              components: [actionRow]
            })
            .catch(() => null);
        } else {
          await webhook
            .editMessage(log.id, {
              embeds: [embed],
              components: [actionRow]
            })
            .catch(() => null);
        }

        await ReportUtils.sendLog({
          config,
          embed: embed,
          userId: client.user!.id,
          action: 'Disregarded',
          reason: `Report automatically disregarded after **${ms(Number(config.message_reports_disregard_after), {
            long: true
          })}**.`
        });
      }

      for (const report of userReports) {
        const config = await DatabaseManager.getGuildEntry(report.guild_id);

        if (report.reported_at + config.user_reports_disregard_after > Date.now()) {
          continue;
        }

        await prisma.userReport.update({
          where: { id: report.id },
          data: { status: 'Disregarded', resolved_at: Date.now(), resolved_by: client.user!.id }
        });

        if (!config.user_reports_webhook) {
          continue;
        }

        const webhook = new WebhookClient({ url: config.user_reports_webhook });
        const log = await webhook.fetchMessage(report.id).catch(() => null);

        if (!log) {
          continue;
        }

        const embed = new EmbedBuilder(log.embeds[0]).setColor(Colors.NotQuiteBlack).setAuthor({ name: 'User Report' });

        const disregardedButton = new ButtonBuilder()
          .setDisabled(true)
          .setLabel('Disregarded (Auto)')
          .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(disregardedButton);

        await webhook
          .editMessage(log.id, {
            embeds: [embed],
            components: [actionRow]
          })
          .catch(() => null);

        await ReportUtils.sendLog({
          config,
          embed: embed,
          userId: client.user!.id,
          action: 'Disregarded',
          reason: `Report automatically disregarded after **${ms(Number(config.user_reports_disregard_after), {
            long: true
          })}**.`
        });
      }
    });
  }

  /**
   * Starts the task runner responsible for managing database message entries.
   */

  public static startMessageRunners(): void {
    CronUtils.startJob(CronSlugs.MessageInsertRunner, messages.insert, false, async () => {
      await DatabaseManager.storeMessageEntries();
    });

    CronUtils.startJob(CronSlugs.MessageDeleteRunner, messages.delete, false, async () => {
      const createdAtThreshold = Date.now() - messages.ttl;
      const duration = ms(messages.ttl, { long: true });
      const createdAtStr = new Date(createdAtThreshold).toLocaleString(undefined, LogDateFormat);

      Logger.info(`Deleting messages created before ${createdAtStr} (olrder than ${duration})...`);

      const { count } = await prisma.message.deleteMany({
        where: {
          created_at: { lte: createdAtThreshold }
        }
      });

      if (!count) {
        Logger.info(`No messages are older than ${duration}`);
      } else {
        Logger.info(`Deleted ${count} ${pluralize(count, 'message')} older than ${duration}`);
      }
    });
  }
}
