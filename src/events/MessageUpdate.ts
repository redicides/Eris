import { Events, Message } from 'discord.js';

import EventListener from '@/managers/events/EventListener';
import MessageCreate from './MessageCreate';

export default class MessageUpdate extends EventListener {
  constructor() {
    super(Events.MessageUpdate);
  }

  async execute(oldMessage: Message, newMessage: Message) {
    await MessageUpdate.handleMessageCommandEdit(oldMessage, newMessage);
  }

  static async handleMessageCommandEdit(oldMessage: Message, newMessage: Message) {
    if (newMessage.system) return;
    if (oldMessage.content === newMessage.content) return;

    return MessageCreate.handleMessageCommand(newMessage);
  }
}
