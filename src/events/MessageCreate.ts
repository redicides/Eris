import EventListener from '@/managers/events/EventListener';
import { Events, Message } from 'discord.js';

export default class MessageCreate extends EventListener {
  constructor() {
    super(Events.MessageCreate);
  }

  async execute(message: Message) {
    if (message.author.bot || message.webhookId !== null) return;
  }
}
