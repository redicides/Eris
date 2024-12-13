import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { InfractionFlag } from '@prisma/client';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { hasPermission, isEphemeralReply } from '@utils/index';
import { UserPermission } from '@utils/Enums';
import { MessageKeys } from '@utils/Keys';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager from '@managers/database/InfractionManager';

export default class Infraction extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      usage: ['search <target> [filter]', 'info <id>', 'delete <id> <reason> [undo-punishment] [notify-receiver]'],
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
                description: 'Toggle if the receiver should be notified of the deletion. False by default.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              }
            ]
          },
          {
            name: InfracionSubcommand.EditReason,
            description: 'Edit the reason of an infraction.',
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
                description: 'The new reason for the infraction.',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 1024
              },
              {
                name: 'notify-receiver',
                description: 'Toggle if the receiver should be notified of the change. False by default.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              }
            ]
          },
          {
            name: InfracionSubcommand.EditDuration,
            description: 'Edit the duration of an infraction.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'id',
                description: 'The infraction ID.',
                type: ApplicationCommandOptionType.String,
                required: true
              },
              {
                name: 'duration',
                description: 'The new duration for the infraction.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
              },
              {
                name: 'reason',
                description: 'The reason for editing the duration.',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 1024
              },
              {
                name: 'notify-receiver',
                description: 'Toggle if the receiver should be notified of the change. False by default.',
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
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const subcommand = interaction.options.getSubcommand() as InfracionSubcommand;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    switch (subcommand) {
      case InfracionSubcommand.Search: {
        const target = interaction.options.getUser('target', true);
        const filter = interaction.options.getString('filter', false) as InfractionFlag | null;

        if (!target) {
          return {
            error: MessageKeys.Errors.TargetNotFound,
            temporary: true
          };
        }

        if (!hasPermission(interaction.member, config, UserPermission.SearchInfractions)) {
          return {
            error: MessageKeys.Errors.MissingUserPermission(UserPermission.SearchInfractions, 'search for infractions'),
            temporary: true
          };
        }

        return InfractionManager.searchInfractions({
          guild_id: interaction.guildId,
          controller_id: interaction.user.id,
          target,
          filter,
          page: 1
        });
      }
      case InfracionSubcommand.Info: {
        const infractionId = interaction.options.getString('id', true);

        return InfractionManager.getInfractionInfo({ id: infractionId, guild_id: interaction.guildId });
      }

      case InfracionSubcommand.Delete: {
        const infraction_id = interaction.options.getString('id', true);
        const reason = interaction.options.getString('reason', true);
        const undo_punishment = interaction.options.getBoolean('undo-punishment', false) ?? false;
        const notify_receiver = interaction.options.getBoolean('notify-receiver', false) ?? false;

        if (!hasPermission(interaction.member, config, UserPermission.DeleteInfractions)) {
          return {
            error: MessageKeys.Errors.MissingUserPermission(UserPermission.DeleteInfractions, 'delete infractions'),
            temporary: true
          };
        }

        return InfractionManager.deleteReceivedInfraction({
          guild: interaction.guild,
          config,
          executor: interaction.member,
          infraction_id,
          undo_punishment,
          notify_receiver,
          reason
        });
      }
      case InfracionSubcommand.EditReason: {
        const infraction_id = interaction.options.getString('id', true);
        const notify_receiver = interaction.options.getBoolean('notify-receiver', false) ?? false;
        const new_reason = interaction.options.getString('reason', true);

        if (!hasPermission(interaction.member, config, UserPermission.UpdateInfractions)) {
          return {
            error: MessageKeys.Errors.MissingUserPermission(
              UserPermission.UpdateInfractions,
              'update the reason of an infraction'
            ),
            temporary: true
          };
        }

        return InfractionManager.editInfractionReason({
          infraction_id,
          new_reason,
          notify_receiver,
          config,
          guild: interaction.guild,
          executor: interaction.member
        });
      }
      case InfracionSubcommand.EditDuration: {
        const infraction_id = interaction.options.getString('id', true);
        const notify_receiver = interaction.options.getBoolean('notify-receiver', false) ?? false;
        const raw_duration = interaction.options.getString('duration', true);
        const edit_reason = interaction.options.getString('reason', true);

        if (!hasPermission(interaction.member, config, UserPermission.UpdateInfractions)) {
          return {
            error: MessageKeys.Errors.MissingUserPermission(
              UserPermission.UpdateInfractions,
              'update the duration of an infraction'
            ),
            temporary: true
          };
        }

        return InfractionManager.editInfractionDuration({
          infraction_id,
          raw_duration,
          edit_reason,
          notify_receiver,
          guild: interaction.guild,
          executor: interaction.member,
          config
        });
      }
    }
  }
}

enum InfracionSubcommand {
  Search = 'search',
  Info = 'info',
  Delete = 'delete',
  EditReason = 'edit-reason',
  EditDuration = 'edit-duration'
}
