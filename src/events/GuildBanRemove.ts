import { Events, GuildBan } from 'discord.js';

import TaskManager from '@/managers/database/TaskManager';
import EventListener from '@/managers/events/EventListener';

export default class GuildBanRemove extends EventListener {
  constructor() {
    super(Events.GuildBanRemove);
  }

  async execute(ban: GuildBan) {
    /**
     * If a user was unbanned (most likely manually) we delete any ban related tasks (if any).
     */

    await TaskManager.deleteTask({
      where: { targetId_guildId_type: { guildId: ban.guild.id, targetId: ban.user.id, type: 'Ban' } }
    }).catch(() => null);
  }
}
