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
    const config = await DatabaseManager.getGuildEntry(guild.id);

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

        // Delete mute task upon ban (if it exists)
        await TaskManager.deleteTask({
          target_id_guild_id_type: { target_id: target.id, guild_id: guild.id, type: 'Mute' }
        });

        break;
      case AuditLogEvent.MemberBanRemove:
        action = InfractionType.Unban;

        // Delete ban task upon unban (if it exists)
        await TaskManager.deleteTask({
          target_id_guild_id_type: { guild_id: guild.id, target_id: target.id, type: 'Ban' }
        });

        break;
      case AuditLogEvent.MemberUpdate:
        {
          const mute = changes.find(change => change.key === 'communication_disabled_until');

          if (mute) {
            if (mute.new) {
              if (!config.native_moderation_integration) return;

              const expires_at = Date.parse(mute.new as string);
              action = InfractionType.Mute;

              const infraction = await InfractionManager.storeInfraction({
                id: InfractionManager.generateInfractionId(),
                guild_id: guild.id,
                target_id: target.id,
                executor_id: executor.id,
                type: action,
                reason,
                expires_at,
                created_at: Date.now(),
                flag: InfractionFlag.Native
              });

              await TaskManager.storeTask({
                guild_id: guild.id,
                target_id: target.id,
                infraction_id: infraction.id,
                type: 'Mute',
                expires_at
              });

              await InfractionManager.logInfraction({ config, infraction });
              return;
            }

            if (!mute.new) {
              action = InfractionType.Unmute;

              // Delete mute task upon unmute
              await TaskManager.deleteTask({
                target_id_guild_id_type: { target_id: target.id, guild_id: guild.id, type: 'Mute' }
              });
            }
          }
        }

        break;
    }

    if (!action || !config.native_moderation_integration) return;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: guild.id,
      target_id: target.id,
      executor_id: executor.id,
      type: action,
      reason,
      created_at: Date.now(),
      flag: InfractionFlag.Native
    });

    return InfractionManager.logInfraction({ config, infraction });
  }
}
