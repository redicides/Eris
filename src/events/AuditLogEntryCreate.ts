import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, GuildMember, User } from 'discord.js';
import { InfractionFlag, InfractionType } from '@prisma/client';

import { elipsify } from '@utils/index';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class AuditLogEntryCreate extends EventListener {
  constructor() {
    super(Events.GuildAuditLogEntryCreate);
  }

  async execute(log: GuildAuditLogsEntry, guild: Guild) {
    const { executor, target, reason: rawReason, changes } = log;
    const config = await DatabaseManager.guilds.get(guild.id);

    if (!executor || executor.id === this.client.user!.id) return;
    if (!(target instanceof User) && !(target instanceof GuildMember)) return;

    const reason = elipsify(rawReason ?? DEFAULT_INFRACTION_REASON, 1024);

    let action: InfractionType | undefined;

    switch (log.action) {
      case AuditLogEvent.MemberKick:
        action = InfractionType.Kick;
        break;
      case AuditLogEvent.MemberBanAdd:
        action = InfractionType.Ban;

        // If the user was banned, we delete any mute related tasks (if any).

        await TaskManager.deleteTask({
          targetId_guildId_type: { targetId: target.id, guildId: guild.id, type: 'Mute' }
        }).catch(() => null);

        break;
      case AuditLogEvent.MemberBanRemove:
        action = InfractionType.Unban;

        // If the user was unbanned, we delete any ban related tasks (if any).

        await TaskManager.deleteTask({
          targetId_guildId_type: { guildId: guild.id, targetId: target.id, type: 'Ban' }
        }).catch(() => null);

        break;
      case AuditLogEvent.MemberUpdate:
        {
          const mute = changes.find(change => change.key === 'communication_disabled_until');

          if (mute) {
            if (mute.new) {
              if (!config.nativeModerationIntegration) return;

              const expiresAt = Date.parse(mute.new as string);
              action = InfractionType.Mute;

              const infraction = await InfractionManager.storeInfraction({
                id: InfractionManager.generateInfractionId(),
                guildId: guild.id,
                targetId: target.id,
                executorId: executor.id,
                type: action,
                reason,
                expiresAt,
                createdAt: Date.now(),
                flag: InfractionFlag.Native
              });

              await TaskManager.storeTask({
                guildId: guild.id,
                targetId: target.id,
                infractionId: infraction.id,
                type: 'Mute',
                expiresAt
              });

              await InfractionManager.logInfraction({ config, infraction });
              return;
            }

            if (!mute.new) {
              action = InfractionType.Unmute;

              await TaskManager.deleteTask({
                targetId_guildId_type: { targetId: target.id, guildId: guild.id, type: 'Mute' }
              }).catch(() => null);
            }
          }
        }

        break;
    }

    if (!action || !config.nativeModerationIntegration) return;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guildId: guild.id,
      targetId: target.id,
      executorId: executor.id,
      type: action,
      reason,
      createdAt: Date.now(),
      flag: InfractionFlag.Native
    });

    await InfractionManager.logInfraction({ config, infraction });
    return;
  }
}
