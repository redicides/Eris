import { Events, Guild } from 'discord.js';

import EventListener from '@terabyte/EventListener';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class GuildCreate extends EventListener {
  constructor() {
    super(Events.GuildCreate);
  }

  async execute(guild: Guild) {
    // Fetch the guild entry from the database if it already exists, if not create a new entry
    await DatabaseManager.getGuildEntry(guild.id);
  }
}
