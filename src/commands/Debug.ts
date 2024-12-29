import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Snowflake
} from 'discord.js';

import { InteractionReplyData } from '@utils/Types';
import { pluralize, uploadData } from '@utils/index';
import { prisma } from '..';

import Command, { CommandCategory } from '@eris/Command';
import InfractionManager from '@managers/database/InfractionManager';

export default class DebugCommand extends Command {
  constructor() {
    super({
      category: CommandCategory.Developer,
      guarded: true,
      devGuildOnly: true,
      data: {
        name: 'debug',
        description: 'Manage the bot.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: DebugSubcommand.ToggleMaintenance,
            description: 'Toggle maintenance mode.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'value',
                description: 'The value to set.',
                type: ApplicationCommandOptionType.Boolean,
                required: true
              }
            ]
          },
          {
            name: DebugSubcommand.DumpGuildInfractions,
            description: 'Dump guild infractions to a file.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'id',
                description: "The guild's ID.",
                type: ApplicationCommandOptionType.String,
                required: false
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const subcommand = interaction.options.getSubcommand() as DebugSubcommand;

    switch (subcommand) {
      case DebugSubcommand.ToggleMaintenance: {
        const value = interaction.options.getBoolean('value', true);

        return DebugCommand.toggleMaintenance(value);
      }

      case DebugSubcommand.DumpGuildInfractions: {
        const id = interaction.options.getString('id', false) ?? interaction.guildId;
        await interaction.deferReply({ ephemeral: false });

        return DebugCommand.dumpGuildInfractions(id);
      }

      default:
        return {
          error: 'Unknown subcommand.',
          ephemeral: true
        };
    }
  }

  private static toggleMaintenance(value: boolean): InteractionReplyData {
    if (eris.maintenance === value) {
      return {
        error: `Maintenance mode is already ${value ? 'enabled' : 'disabled'}.`,
        temporary: true,
        ephemeral: false
      };
    }

    eris.maintenance = value;

    return {
      content: `Maintenance mode has been ${
        value ? 'enabled. Commands and logging have been paused. Cron jobs are not affected' : 'disabled'
      }.`,
      ephemeral: false
    };
  }

  private static async dumpGuildInfractions(id: Snowflake): Promise<InteractionReplyData> {
    const infractions = await prisma.infraction.findMany({ where: { guild_id: id } });

    if (!infractions.length) {
      return {
        error: `No infractions found for guild \`${id}\`.`,
        temporary: true
      };
    }

    const data = infractions
      .map(infraction => {
        return InfractionManager._parseInfractionData(infraction);
      })
      .join('\n\n');

    const dataUrl = await uploadData(data, `txt`);
    const buffer = Buffer.from(data, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `infractions-${id}.txt` });
    const urlButton = new ButtonBuilder().setURL(dataUrl).setLabel('Open In Browser').setStyle(ButtonStyle.Link);

    return {
      content: `Dumped ${infractions.length} ${pluralize(infractions.length, 'infraction')} for guild \`${id}\`.`,
      files: [attachment],
      components: [new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton)]
    };
  }
}

enum DebugSubcommand {
  ToggleMaintenance = 'toggle-maintenance',
  DumpGuildInfractions = 'dump-infractions'
}
