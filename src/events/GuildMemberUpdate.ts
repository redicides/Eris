import { Events, GuildMember } from 'discord.js';

import TaskManager from '@/managers/database/TaskManager';
import EventListener from '@/managers/events/EventListener';

export default class GuildMemberUpdate extends EventListener {
  constructor() {
    super(Events.GuildMemberUpdate);
  }

  async execute(oldMember: GuildMember, newMember: GuildMember) {
    if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
      // Member was most likely unmuted manually, so we delete all  mute task for this user (if any)

      await TaskManager.deleteTask({
        where: { targetId_guildId_type: { guildId: newMember.guild.id, targetId: newMember.id, type: 'Mute' } }
      }).catch(() => null);
    }
  }
}
