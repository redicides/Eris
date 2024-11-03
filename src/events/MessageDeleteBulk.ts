import {
  type PartialMessage,
  type Message as DiscordMessage,
  Events,
  Collection,
  Snowflake,
  GuildTextBasedChannel
} from 'discord.js';

import EventListener from '@/managers/events/EventListener';
import DatabaseManager from '@/managers/database/DatabaseManager';

export default class MessageDeleteBulk extends EventListener {
  constructor() {
    super(Events.MessageBulkDelete);
  }

  async execute(
    deletedMessages: Collection<Snowflake, PartialMessage | DiscordMessage<true>>,
    channel: GuildTextBasedChannel
  ) {
    const config = await DatabaseManager.getGuildEntry(channel.guild.id);

    if (config.messageLoggingStoreMessages) {
      await DatabaseManager.bulkDeleteMessageEntries(deletedMessages);
    }
  }
}
