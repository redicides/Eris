import { ApplicationCommandType, ChatInputCommandInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Ping extends Command {
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

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const start = performance.now();
    await interaction.deferReply({ ephemeral });
    const end = performance.now();

    return {
      content: `Pong! Roundtrip took: ${Math.round(end - start)}ms. Heartbeat: ${this.client.ws.ping}ms.`
    };
  }
}
