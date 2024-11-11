import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { InfractionFlag } from '@prisma/client';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { hasPermission } from '@utils/index';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager from '@managers/database/InfractionManager';

export default class Infraction extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      usage: ['search <target> [filter]', 'info <id>'],
      data: {
        name: 'infraction',
        description: 'Manage infractions.',
        defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: InfracionSubcommand.Search,
            description: 'Search for infractions.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The target user.',
                type: ApplicationCommandOptionType.User,
                required: true
              },
              {
                name: 'filter',
                description: 'The filter to apply.',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                  { name: 'Automatic', value: InfractionFlag.Automatic },
                  { name: 'Native', value: InfractionFlag.Native }
                ]
              }
            ]
          },
          {
            name: InfracionSubcommand.Info,
            description: 'Get information about an infraction.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'id',
                description: 'The infraction ID.',
                type: ApplicationCommandOptionType.String,
                required: true
              }
            ]
          },
          {
            name: InfracionSubcommand.Delete,
            description: 'Delete an infraction.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'id',
                description: 'The infraction ID.',
                type: ApplicationCommandOptionType.String,
                required: true
              },
              {
                name: 'reason',
                description: 'The reason for deleting the infraction.',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 1024
              },
              {
                name: 'undo-punishment',
                description: 'If applicable, undo the punishment associated with the infraction.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              },
              {
                name: 'notify-receiver',
                description: 'Toggle if the receiver should be notified of the deletion.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              }
            ]
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const subcommand = interaction.options.getSubcommand() as InfracionSubcommand;

    await interaction.deferReply({ ephemeral });

    switch (subcommand) {
      case InfracionSubcommand.Search: {
        const target = interaction.options.getUser('target', true);
        const filter = interaction.options.getString('filter', false) as InfractionFlag | null;

        if (!target) {
          return {
            error: 'The target user could not be found.',
            temporary: true
          };
        }

        if (!hasPermission(interaction.member, config, 'SearchInfractions')) {
          return {
            error: "You do not have permission to search this user's infractions.",
            temporary: true
          };
        }

        return InfractionManager.searchInfractions({
          guildId: interaction.guildId,
          controllerId: interaction.user.id,
          target,
          filter,
          page: 1
        });
      }
      case InfracionSubcommand.Info: {
        const infractionId = interaction.options.getString('id', true);

        return InfractionManager.getInfractionInfo({ id: infractionId, guildId: interaction.guildId });
      }

      case InfracionSubcommand.Delete: {
        const infractionId = interaction.options.getString('id', true);
        const reason = interaction.options.getString('reason', true);
        const undoPunishment = interaction.options.getBoolean('undo-punishment', false) ?? false;
        const notifyReceiver = interaction.options.getBoolean('notify-receiver', false) ?? true;

        if (!hasPermission(interaction.member, config, 'DeleteInfractions')) {
          return {
            error: 'You do not have permission to delete infractions.',
            temporary: true
          };
        }

        return InfractionManager.deleteReceivedInfraction({
          guild: interaction.guild,
          config,
          executor: interaction.member,
          infractionId,
          undoPunishment,
          notifyReceiver,
          reason
        });
      }
    }
  }
}

enum InfracionSubcommand {
  Search = 'search',
  Info = 'info',
  Delete = 'delete'
}
