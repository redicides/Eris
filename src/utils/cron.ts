import { CronJob, CronJobParams } from 'cron';
import { PermissionFlagsBits } from 'discord.js';
import { EmbedBuilder } from '@discordjs/builders';

import { CRON_SLUGS, DEFAULT_TIMEZONE } from '@utils/constants';
import { client, prisma, Sentry } from '@/index';
import { GuildCache } from '@utils/cache';

import Logger, { AnsiColor } from '@utils/logger';
import ConfigManager from '@/managers/config/ConfigManager';
import InfractionManager, { INFRACTION_COLORS } from '@/managers/database/InfractionManager';
import TaskManager from '@/managers/database/TaskManager';

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
   * @param onTick - The function to run on each tick
   */
  public static startJob(
    monitorSlug: string,
    cronTime: CronJobParams['cronTime'],
    onTick: () => Promise<void> | void
  ): void {
    const cronJobWithCheckIn = Sentry.cron.instrumentCron(CronJob, monitorSlug);

    cronJobWithCheckIn
      .from({
        cronTime,
        timeZone: DEFAULT_TIMEZONE,
        onTick: async () => {
          if (monitorSlug !== CRON_SLUGS.TaskRunner)
            Logger.log(monitorSlug, 'Running cron job...', {
              color: AnsiColor.Cyan
            });

          await onTick();

          if (monitorSlug !== CRON_SLUGS.TaskRunner)
            Logger.log(monitorSlug, 'Successfully ran cron job.', {
              color: AnsiColor.Green
            });
        }
      })
      .start();

    Logger.log(monitorSlug, `Cron job started: ${cronTime}`, {
      color: AnsiColor.Orange
    });
  }

  /**
   * Starts the task runner responsible for removing expired infractions.
   */

  public static startTaskRunner(): void {
    return CronUtils.startJob('TASK_RUNNER', ConfigManager.global_config.database.task_runner_cron, async () => {
      await prisma.infraction.deleteMany({
        where: {
          type: 'Warn',
          expiresAt: { lte: Date.now() }
        }
      });

      const guilds = await prisma.guild.findMany({
        select: { id: true, tasks: { where: { expiresAt: { lte: Date.now() } } } }
      });

      for (const guildTasks of guilds) {
        const guild = await client.guilds.fetch(guildTasks.id).catch(() => null);

        if (!guild) {
          await prisma.task.deleteMany({
            where: {
              guildId: guildTasks.id,
              expiresAt: { lte: Date.now() }
            }
          });

          continue;
        }

        const config = await GuildCache.get(guild.id);
        const permissions = guild.members.me!.permissions;
        const banPermissions = permissions.has(PermissionFlagsBits.BanMembers);

        if (!banPermissions) {
          await prisma.task.deleteMany({
            where: {
              guildId: guild.id,
              type: 'Ban',
              expiresAt: { lte: Date.now() }
            }
          });

          continue;
        }

        for (const task of guildTasks.tasks) {
          if (task.type === 'Ban') {
            await guild.members.unban(task.targetId).catch(() => {});
          } else {
            const member = await guild.members.fetch(task.targetId).catch(() => null);

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
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
                .setColor(INFRACTION_COLORS.Unmute)
                .setTitle(`You've been unmuted in ${guild.name}`)
                .setFields([{ name: 'Reason', value: 'Mute expired based on duration.' }])
                .setTimestamp();

              await member.send({ embeds: [embed] }).catch(() => {});
            }
          }

          await TaskManager.deleteTask({ where: { id: task.id } });

          const infraction = await InfractionManager.storeInfraction({
            guildId: guild.id,
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
}
