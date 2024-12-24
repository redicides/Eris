import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from 'discord.js';
import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@terabyte/Command';

export default class TerabyeCommand extends Command {
  constructor() {
    super({
      category: CommandCategory.Developer,
      guarded: true,
      data: {
        name: 'terabyte',
        description: 'Manage Terabyte.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'maintenance',
            description: 'Toggle maintenance mode.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'toggle',
                description: 'The value to set.',
                type: ApplicationCommandOptionType.Boolean,
                required: true
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const value = interaction.options.getBoolean('toggle', true);

    if (terabyte.maintenance === value) {
      return {
        error: `Maintenance mode is already ${value ? 'enabled' : 'disabled'}.`,
        ephemeral: true
      };
    }

    terabyte.maintenance = value;

    return {
      content: `Maintenance mode has been ${
        value ? 'enabled. Commands and logging have been paused. Cron jobs are not affected' : 'disabled'
      }.`,
      ephemeral: true
    };
  }
}
