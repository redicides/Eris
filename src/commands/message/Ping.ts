import { CommandCategory } from '@/managers/commands/ApplicationCommand';
import MessageCommand from '@/managers/commands/MessageCommand';
import { Message } from 'discord.js';

export default class Ping extends MessageCommand {
  constructor() {
    super({
      category: CommandCategory.Utility,
      name: 'ping',
      aliases: ['heartbeat'],
      description: 'Get the websocket heartbeat and roundtrip latency.',
      allowInDms: true
    });
  }

  async execute(message: Message) {
    const start = performance.now();
    const msg = await message.reply('Pinging...');
    const end = performance.now();

    return msg.edit(`Pong! Roundtrip took: ${Math.round(end - start)}ms. Heartbeat: ${this.client.ws.ping}ms.`);
  }
}
