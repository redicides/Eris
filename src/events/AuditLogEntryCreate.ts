import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, GuildMember, User } from 'discord.js';
import { InfractionFlag, InfractionAction } from '@prisma/client';

import { elipsify } from '@utils/index';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import InfractionManager, { DefaultInfractionReason } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class AuditLogEntryCreate extends EventListener {
  constructor() {
    super(Events.GuildAuditLogEntryCreate);
  }

  async execute(log: GuildAuditLogsEntry, guild: Guild) {
    const { executor, target, reason: rawReason, changes } = log;

    if (!executor || executor.id === this.client.user!.id) return;
    if (!(target instanceof User) && !(target instanceof GuildMember)) return;

    const config = await DatabaseManager.getGuildEntry(guild.id);
    const reason = elipsify(rawReason ?? DefaultInfractionReason, 1024);

    let action: InfractionAction | undefined;

    switch (log.action) {
      case AuditLogEvent.MemberKick:
        action = InfractionAction.Kick;
        break;
      case AuditLogEvent.MemberBanAdd:
        action = InfractionAction.Ban;

        // Delete mute task upon ban (if it exists)
        await TaskManager.deleteTask({
          target_id_guild_id_action: { target_id: target.id, guild_id: guild.id, action: 'Mute' }
        });

        break;
      case AuditLogEvent.MemberBanRemove:
        action = InfractionAction.Unban;

        // Delete ban task upon unban (if it exists)
        await TaskManager.deleteTask({
          target_id_guild_id_action: { guild_id: guild.id, target_id: target.id, action: 'Ban' }
        });

        break;
      case AuditLogEvent.MemberUpdate:
        {
          const mute = changes.find(change => change.key === 'communication_disabled_until');

          if (mute) {
            if (mute.new) {
              if (!config.native_moderation_integration) return;

              const expiresAt = new Date(Date.parse(mute.new as string));

              action = InfractionAction.Mute;

              const infraction = await InfractionManager.storeInfraction({
                id: InfractionManager.generateInfractionId(),
                guild_id: guild.id,
                target_id: target.id,
                executor_id: executor.id,
                action,
                reason,
                expires_at: expiresAt,
                flag: InfractionFlag.Native
              });

              await TaskManager.storeTask({
                guild_id: guild.id,
                target_id: target.id,
                infraction_id: infraction.id,
                action: 'Mute',
                expires_at: expiresAt
              });

              await InfractionManager.logInfraction(config, infraction);
              return;
            }

            if (!mute.new) {
              action = InfractionAction.Unmute;

              // Delete mute task upon unmute
              await TaskManager.deleteTask({
                target_id_guild_id_action: { target_id: target.id, guild_id: guild.id, action: 'Mute' }
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
      action,
      reason,
      flag: InfractionFlag.Native
    });

    return InfractionManager.logInfraction(config, infraction);
  }
}
