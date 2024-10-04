import { Events, GuildBan } from 'discord.js';

import TaskManager from '@/managers/database/TaskManager';
import EventListener from '@/managers/events/EventListener';

export default class GuildBanRemove extends EventListener {
  constructor() {
    super(Events.GuildBanRemove);
  }

  async execute(ban: GuildBan) {
    // User was most likely unbanned manually, so we delete all ban task for this user (if any)

    await TaskManager.deleteTask({
      where: { targetId_guildId_type: { guildId: ban.guild.id, targetId: ban.user.id, type: 'Ban' } }
    }).catch(() => null);
  }
}
