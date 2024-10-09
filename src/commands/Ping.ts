import { ApplicationCommandType, ChatInputCommandInteraction } from 'discord.js';

import { InteractionReplyData } from '@/utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Ping extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      data: {
        name: 'ping',
        description: 'Get the websocket heartbeat and roundtrip latency.',
        type: ApplicationCommandType.ChatInput
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const start = performance.now();
    await interaction.deferReply({ ephemeral: true });
    const end = performance.now();

    return { content: `Pong! Roundtrip took: ${Math.round(end - start)}ms. Heartbeat: ${this.client.ws.ping}ms.` };
  }
}
