import { Events, GuildBan } from 'discord.js';

import TaskManager from '@managers/database/TaskManager';
import EventListener from '@managers/events/EventListener';

export default class GuildBanAdd extends EventListener {
  constructor() {
    super(Events.GuildBanAdd);
  }

  async execute(ban: GuildBan) {
    /**
     * If a user was banned, we delete any mute related tasks (if any).
     */
    await TaskManager.deleteTask({
      where: {
        targetId_guildId_type: { targetId: ban.user.id, guildId: ban.guild.id, type: 'Mute' }
      }
    });
  }
}
