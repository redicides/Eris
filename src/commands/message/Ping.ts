import { Message } from 'discord.js';
import { reply, send } from '@skyra/editable-commands';

import { CommandCategory } from '@/managers/commands/ApplicationCommand';

import MessageCommand from '@/managers/commands/MessageCommand';

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
    await reply(message, 'Pinging...');
    const end = performance.now();

    return send(message, `Pong! Roundtrip took: ${Math.round(end - start)}ms. Heartbeat: ${this.client.ws.ping}ms.`);
  }
}
