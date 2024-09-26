import { Events, Message } from 'discord.js';

import EventListener from '@/managers/events/EventListener';
import GuildCache from '@managers/database/GuildCache';

export default class MentionPrefix extends EventListener {
  constructor() {
    super(Events.MentionPrefix);
  }

  async execute(message: Message) {
    if (message.inGuild()) {
      const guild = await GuildCache.get(message.guildId);
      if (guild.disabledMentionPrefix) return;

      return message.reply(`My prefix for this server is \`${guild.msgCmdsPrefix}\`.`);
    }
  }
}
