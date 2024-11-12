import { Events, Guild } from 'discord.js';

import EventListener from '@managers/events/EventListener';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class GuildCreate extends EventListener {
  constructor() {
    super(Events.GuildCreate);
  }

  async execute(guild: Guild) {
    await DatabaseManager.confirmDatabaseGuildEntry(guild.id);
  }
}
