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

import { CRON_SLUGS, DEFAULT_TIMEZONE } from '@utils/Constants';
import { ReportUtils } from '@utils/Reports';
import { client, prisma, Sentry } from '@/index';

import Logger, { AnsiColor } from '@utils/Logger';
import ConfigManager from '@managers/config/ConfigManager';
import InfractionManager, { INFRACTION_COLORS } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';
import DatabaseManager from '@/managers/database/DatabaseManager';

const { task_runner_cron, report_disregard_cron } = ConfigManager.global_config.database;

/**
 * The class responsible for handling/managing cron utilities.

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
   * @param cronTime - The cron time string (timezone: {@link DEFAULT_TIMEZONE})
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
        timeZone: DEFAULT_TIMEZONE,
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
   * Starts the task runner responsible for removing expired infractions.
   */

  public static startTaskRunner(): void {
    return CronUtils.startJob('TASK_RUNNER', task_runner_cron, true, async () => {
      await prisma.infraction.deleteMany({
        where: {
          type: 'Warn',
          expiresAt: { lte: Date.now() }
        }
      });

      const dbGuilds = await prisma.guild.findMany({
        select: { id: true, notifyUnmuteAction: true, tasks: { where: { expiresAt: { lte: Date.now() } } } }
      });

      for (const dbGuild of dbGuilds) {
        const discordGuild = await client.guilds.fetch(dbGuild.id).catch(() => null);

        if (!discordGuild) {
          await prisma.task.deleteMany({
            where: {
              guildId: dbGuild.id,
              expiresAt: { lte: Date.now() }
            }
          });

          continue;
        }

        const config = await DatabaseManager.guilds.get(discordGuild.id);
        const permissions = discordGuild.members.me!.permissions;
        const banPermissions = permissions.has(PermissionFlagsBits.BanMembers);

        if (!banPermissions) {
          await prisma.task.deleteMany({
            where: {
              guildId: discordGuild.id,
              type: 'Ban',
              expiresAt: { lte: Date.now() }
            }
          });

          continue;
        }

        for (const task of dbGuild.tasks) {
          if (task.type === 'Ban') {
            await discordGuild.members.unban(task.targetId).catch(() => {});
          } else {
            const member = await discordGuild.members.fetch(task.targetId).catch(() => null);

            if (member) {
              if (
                member.communicationDisabledUntil &&
                +member.communicationDisabledUntil > Number(task.expiresAt) + 10000
              ) {
                await prisma.task.update({
                  where: {
                    id: task.id
                  },
                  data: {
                    expiresAt: +member.communicationDisabledUntil
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

              if (dbGuild.notifyUnmuteAction) await member.send({ embeds: [embed] }).catch(() => {});
            }
          }

          await TaskManager.deleteTask({ where: { id: task.id } });

          const infraction = await InfractionManager.storeInfraction({
            id: InfractionManager.generateInfractionId(),
            guildId: discordGuild.id,
            targetId: task.targetId,
            executorId: client.user!.id,
            type: task.type === 'Ban' ? 'Unban' : 'Unmute',
            reason: `${task.type} expired based on duration.`,
            createdAt: Date.now()
          });

          await InfractionManager.logInfraction({ config, infraction });
        }
      }
    });
  }

  /**
   * Starts the task runner responsible for disregarding expired reports.
   */

  public static startReportDisregardRunner(): void {
    return CronUtils.startJob(CRON_SLUGS.ReportDisregardRunner, report_disregard_cron, true, async () => {
      const messageReports = await prisma.messageReport.findMany({
        where: {
          reportedAt: { lte: Date.now() },
          status: 'Pending'
        }
      });

      const userReports = await prisma.userReport.findMany({
        where: {
          reportedAt: { lte: Date.now() },
          status: 'Pending'
        }
      });

      for (const report of messageReports) {
        const config = await DatabaseManager.guilds.get(report.guildId);

        if (report.reportedAt + config.messageReportsDisregardAfter > Date.now()) {
          continue;
        }

        await prisma.messageReport.update({
          where: { id: report.id },
          data: { status: 'Disregarded', resolvedAt: Date.now(), resolvedBy: client.user!.id }
        });

        if (!config.messageReportsWebhook) {
          continue;
        }

        const webhook = new WebhookClient({ url: config.messageReportsWebhook });
        const log = await webhook.fetchMessage(report.id).catch(() => null);

        if (!log) {
          continue;
        }

        const primaryEmbed = log.embeds[log.components!.length === 1 ? 0 : 1];
        const secondaryEmbed = log.embeds[0] ?? null;

        const embed = new EmbedBuilder(primaryEmbed).setColor(Colors.NotQuiteBlack);

        const disregardedButton = new ButtonBuilder()
          .setCustomId('?')
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
          reason: `Report automatically disregarded after **${ms(Number(config.messageReportsDisregardAfter), {
            long: true
          })}**.`
        });

        continue;
      }

      for (const report of userReports) {
        const config = await DatabaseManager.guilds.get(report.guildId);

        if (report.reportedAt + config.userReportsDisregardAfter > Date.now()) {
          continue;
        }

        await prisma.userReport.update({
          where: { id: report.id },
          data: { status: 'Disregarded', resolvedAt: Date.now(), resolvedBy: client.user!.id }
        });

        if (!config.userReportsWebhook) {
          continue;
        }

        const webhook = new WebhookClient({ url: config.userReportsWebhook });
        const log = await webhook.fetchMessage(report.id).catch(() => null);

        if (!log) {
          continue;
        }

        const embed = new EmbedBuilder(log.embeds[0]).setColor(Colors.NotQuiteBlack);

        const disregardedButton = new ButtonBuilder()
          .setCustomId('?')
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
          reason: `Report automatically disregarded after **${ms(Number(config.userReportsDisregardAfter), {
            long: true
          })}**.`
        });

        continue;
      }
    });
  }
}
