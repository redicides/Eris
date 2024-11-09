import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from 'discord.js';

import ms from 'ms';

import { parseDuration } from '@utils/index';
import { RequestUtils } from '@utils/Requests';
import { GuildConfig, InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Request extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      data: {
        name: 'request',
        description: 'Request a moderation action.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: RequestSubcommand.Mute,
            description: 'Request a mute.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The target user.',
                type: ApplicationCommandOptionType.User,
                required: true
              },
              {
                name: 'duration',
                description: 'The duration of the mute.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
              },
              {
                name: 'reason',
                description: 'The reason for the mute.',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 1024
              }
            ]
          },
          {
            name: RequestSubcommand.Ban,
            description: 'Request a ban.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The target user.',
                type: ApplicationCommandOptionType.User,
                required: true
              },
              {
                name: 'reason',
                description: 'The reason for the ban.',
                type: ApplicationCommandOptionType.String,
                required: true,
                max_length: 1024
              },
              {
                name: 'duration',
                description: 'The duration of the ban.',
                type: ApplicationCommandOptionType.String,
                required: false,
                autocomplete: true
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
  ): Promise<InteractionReplyData | null> {
    const subcommand = interaction.options.getSubcommand() as RequestSubcommand;

    switch (subcommand) {
      case RequestSubcommand.Mute: {
        if (!config.muteRequestsEnabled) {
          return {
            error: 'Mute requests are not enabled in this server.',
            temporary: true
          };
        }

        if (!config.muteRequestsWebhook) {
          return {
            error: 'Mute requests are not configured in this server.',
            temporary: true
          };
        }

        const target = interaction.options.getMember('target');
        const rawDuration = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason', true);

        if (!target) {
          return {
            error: 'The provided target is invalid.',
            temporary: true
          };
        }

        if (config.muteRequestsImmuneRoles.some(role => target.roles.cache.has(role))) {
          return {
            error: 'The provided target is immune to mute requests.',
            temporary: true
          };
        }

        const duration = parseDuration(rawDuration);

        if (Number.isNaN(duration)) {
          return {
            error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
            temporary: true
          };
        }

        if (duration < 1000) {
          return {
            error: 'The duration must be at least 1 second.',
            temporary: true
          };
        }

        if (duration > ms('28d')) {
          return {
            error: 'The duration must not exceed 28 days.',
            temporary: true
          };
        }

        if (target.isCommunicationDisabled()) {
          return {
            error: 'The provided target is already muted.',
            temporary: true
          };
        }

        const exists = await this.prisma.muteRequest.findFirst({
          where: {
            guildId: interaction.guild.id,
            targetId: target.id,
            requestedBy: interaction.user.id,
            status: 'Pending'
          }
        });

        if (exists) {
          return {
            error: 'You already have a pending mute request for this user.',
            temporary: true
          };
        }

        await interaction.deferReply({ ephemeral });

        return RequestUtils.createMuteRequest({
          config,
          guildId: interaction.guild.id,
          requestedBy: interaction.user.id,
          target,
          duration,
          reason
        });
      }

      case RequestSubcommand.Ban: {
        if (!config.banRequestsEnabled) {
          return {
            error: 'Ban requests are not enabled in this server.',
            temporary: true
          };
        }

        if (!config.banRequestsWebhook) {
          return {
            error: 'Ban requests are not configured in this server.',
            temporary: true
          };
        }

        const target = interaction.options.getUser('target', true);
        const rawDuration = interaction.options.getString('duration', false);
        const reason = interaction.options.getString('reason', true);

        if (!target) {
          return {
            error: 'The provided target is invalid.',
            temporary: true
          };
        }

        if (
          config.banRequestsImmuneRoles.some(role =>
            interaction.guild.members.cache.get(target.id)?.roles.cache.has(role)
          )
        ) {
          return {
            error: 'The provided target is immune to ban requests.',
            temporary: true
          };
        }

        const duration = rawDuration ? parseDuration(rawDuration) : null;

        if (Number.isNaN(duration)) {
          return {
            error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
            temporary: true
          };
        }

        if (duration) {
          if (duration < 1000) {
            return {
              error: 'The duration must be at least 1 second.',
              temporary: true
            };
          }

          if (duration > ms('365d')) {
            return {
              error: 'The duration must not exceed 1 year.',
              temporary: true
            };
          }
        }

        if (await interaction.guild.bans.fetch(target.id).catch(() => null)) {
          return {
            error: 'The provided target is already banned.',
            temporary: true
          };
        }

        const exists = await this.prisma.banRequest.findFirst({
          where: {
            guildId: interaction.guild.id,
            targetId: target.id,
            requestedBy: interaction.user.id,
            status: 'Pending'
          }
        });

        if (exists) {
          return {
            error: 'You already have a pending ban request for this user.',
            temporary: true
          };
        }

        await interaction.deferReply({ ephemeral });

        return RequestUtils.createBanRequest({
          config,
          guildId: interaction.guild.id,
          requestedBy: interaction.user.id,
          target,
          duration,
          reason
        });
      }
    }
  }
}

enum RequestSubcommand {
  Mute = 'mute',
  Ban = 'ban'
}
