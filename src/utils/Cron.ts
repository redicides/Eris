import { CronJob, CronJobParams } from 'cron';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import ms from 'ms';

import { CronSlugs, DefaultTimezone, LogDateFormat } from '@utils/Constants';
import { client, prisma, Sentry } from '@/index';
import { pluralize } from '.';

import Logger, { AnsiColor } from '@utils/Logger';
import ConfigManager from '@managers/config/ConfigManager';
import InfractionManager, { InfractionColors } from '@managers/database/InfractionManager';
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
          action: 'Warn',
          expires_at: { lte: new Date() }
        }
      });

      const dbGuilds = await prisma.guild.findMany({
        select: {
          id: true,
          notify_unmute_action: true,
          infraction_tasks: { where: { expires_at: { lte: new Date() } } }
        }
      });

      for (const dbGuild of dbGuilds) {
        const discordGuild = await client.guilds.fetch(dbGuild.id).catch(() => null);

        if (!discordGuild) {
          await prisma.infractionTask.deleteMany({
            where: {
              guild_id: dbGuild.id,
              expires_at: { lte: new Date() }
            }
          });

          continue;
        }

        const config = await DatabaseManager.getGuildEntry(discordGuild.id);
        const permissions = discordGuild.members.me!.permissions;
        const banPermissions = permissions.has(PermissionFlagsBits.BanMembers);

        if (!banPermissions) {
          await prisma.infractionTask.deleteMany({
            where: {
              guild_id: discordGuild.id,
              action: 'Ban',
              expires_at: { lte: new Date() }
            }
          });

          continue;
        }

        for (const task of dbGuild.infraction_tasks) {
          if (task.action === 'Ban') {
            await discordGuild.members.unban(task.target_id).catch(() => null);
          } else {
            const member = await discordGuild.members.fetch(task.target_id).catch(() => null);

            if (member) {
              if (
                member.communicationDisabledUntil &&
                +member.communicationDisabledUntil > Number(task.expires_at) + 10000
              ) {
                await prisma.infractionTask.update({
                  where: {
                    id: task.id
                  },
                  data: {
                    expires_at: member.communicationDisabledUntil
                  }
                });

                continue;
              }

              const embed = new EmbedBuilder()
                .setAuthor({ name: discordGuild.name, iconURL: discordGuild.iconURL() ?? undefined })
                .setColor(InfractionColors.Unmute)
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
            action: task.action === 'Ban' ? 'Unban' : 'Unmute',
            reason: `${task.action} expired based on duration.`
          });

          await InfractionManager.logInfraction(config, infraction);
        }
      }
    });
  }

  /**
   * Starts the task runner responsible for disregarding reports after a certain time.
   */

  public static startReportDisregardRunner(): void {
    return CronUtils.startJob(CronSlugs.ReportDisregardRunner, runners.reports, true, async () => {
      // Update the status of reports that have been disregarded

      await prisma.$executeRaw`
        UPDATE "MessageReport"
        SET "status" = 'Disregarded'
        WHERE "id" IN (
          SELECT M."id"
          FROM "MessageReport" M
          INNER JOIN "Guild" G ON M."guild_id" = G."id"
          WHERE M."reported_at" + (G."message_reports_disregard_after" * INTERVAL '1 millisecond') <= now()
        )
      `;

      await prisma.$executeRaw`
        UPDATE "UserReport"
        SET "status" = 'Disregarded'
        WHERE "id" IN (
          SELECT U."id"
          FROM "UserReport" U
          INNER JOIN "Guild" G ON U."guild_id" = G."id"
          WHERE U."reported_at" + (G."user_reports_disregard_after" * INTERVAL '1 millisecond') <= now()
          )`;
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
      const createdAtThreshold = new Date(Date.now() - messages.ttl);
      const duration = ms(messages.ttl, { long: true });
      const createdAtStr = createdAtThreshold.toLocaleString(undefined, LogDateFormat);

      Logger.info(`Deleting messages created before ${createdAtStr} (olrder than ${duration})...`);

      const { count } = await prisma.message.deleteMany({
        where: {
          created_at: { lte: createdAtThreshold }
        }
      });

      if (!count) {
        Logger.info(`No messages were created before ${createdAtStr} (older than ${duration})`);
      } else {
        Logger.info(
          `Deleted ${count} ${pluralize(count, 'message')} created before ${createdAtStr} (older than ${duration})`
        );
      }
    });
  }
}
