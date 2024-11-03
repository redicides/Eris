import { Events, Message } from 'discord.js';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';

export default class MessageCreate extends EventListener {
  constructor() {
    super(Events.MessageCreate);
  }

  async execute(message: Message) {
    if (!message.inGuild()) return;

    const config = await DatabaseManager.getGuildEntry(message.guild.id);

    if (config.messageLoggingStoreMessages) {
      if (!message.author.bot || message.webhookId === null) {
        DatabaseManager.queueMessageEntry(message);
      }
    }
  }
}
