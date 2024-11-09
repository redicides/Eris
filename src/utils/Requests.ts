import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  EmbedData,
  GuildMember,
  messageLink,
  ModalBuilder,
  ModalSubmitInteraction,
  roleMention,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  User,
  userMention,
  WebhookClient
} from 'discord.js';

import ms from 'ms';

import { GuildConfig, InteractionReplyData } from './Types';
import { capitalize, userMentionWithId } from '.';
import { client, prisma } from '..';
import { MuteRequest } from '@prisma/client';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';
import TaskManager from '@/managers/database/TaskManager';

export class RequestUtils {
  /**
   * Submit a new mute request.
   *
   * @param data.config The guild configuration
   * @param data.guildId The guild ID
   * @param data.target The target member
   * @param data.requestedBy The user who requested the mute
   * @param data.duration The duration of the mute
   * @param data.reason The reason for the mute
   *
   * @returns The interaction reply data
   */
  public static async createMuteRequest(data: {
    config: GuildConfig;
    guildId: Snowflake;
    target: GuildMember;
    requestedBy: Snowflake;
    duration: number;
    reason: string;
  }): Promise<InteractionReplyData> {
    const { config, guildId, target, requestedBy, duration, reason } = data;

    const requestedAt = Date.now();
    const expiresAt = requestedAt + duration;

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({ name: 'New Mute Request' })
      .setThumbnail(target.user.displayAvatarURL())
      .setFields([
        { name: 'Target', value: userMentionWithId(target.id) },
        { name: 'Requested By', value: userMentionWithId(requestedBy) },
        { name: 'Duration', value: ms(duration, { long: true }) },
        { name: 'Reason', value: reason }
      ])
      .setTimestamp();

    const acceptButton = new ButtonBuilder()
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success)
      .setCustomId(`mute-request-accept`);

    const denyButton = new ButtonBuilder()
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`mute-request-deny`);

    const disregardButton = new ButtonBuilder()
      .setLabel('Disregard')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`mute-request-disregard`);

    const userInfoButton = new ButtonBuilder()
      .setLabel('User Info')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`user-info-${target.id}`);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
      acceptButton,
      denyButton,
      disregardButton,
      userInfoButton
    );

    const webhook = new WebhookClient({ url: config.muteRequestsWebhook! });

    const content =
      config.muteRequestsPingRoles.length > 0
        ? config.muteRequestsPingRoles.map(r => roleMention(r)).join(', ')
        : undefined;

    const log = await webhook.send({
      content,
      embeds: [embed],
      components: [actionRow],
      allowedMentions: { parse: ['roles'] }
    });

    if (!log) {
      return {
        error: 'Failed to submit the mute request.',
        temporary: true
      };
    }

    await prisma.muteRequest.create({
      data: {
        id: log.id,
        guildId,
        targetId: target.id,
        requestedBy,
        requestedAt,
        expiresAt,
        reason
      }
    });

    return {
      content: `Successfully submitted a mute request for ${target} - ID \`#${log.id}\``
    };
  }

  /**
   * Create a new ban request.
   *
   * @param data.config The guild configuration
   * @param data.guildId The guild ID
   * @param data.target The target user
   * @param data.requestedBy The user who requested the ban
   * @param data.duration The duration of the ban
   * @param data.reason The reason for the ban
   *
   * @returns The interaction reply data
   */

  public static async createBanRequest(data: {
    config: GuildConfig;
    guildId: Snowflake;
    target: User;
    requestedBy: Snowflake;
    duration: number | null;
    reason: string;
  }) {
    const { config, guildId, target, requestedBy, duration, reason } = data;

    const requestedAt = Date.now();
    const expiresAt = duration ? requestedAt + duration : null;

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({ name: 'New Ban Request' })
      .setThumbnail(target.displayAvatarURL())
      .setFields([
        { name: 'Target', value: userMentionWithId(target.id) },
        { name: 'Requested By', value: userMentionWithId(requestedBy) },
        { name: 'Reason', value: reason }
      ])
      .setTimestamp();

    if (duration) {
      embed.spliceFields(2, 0, { name: 'Duration', value: ms(duration, { long: true }) });
    }

    const acceptButton = new ButtonBuilder()
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success)
      .setCustomId(`ban-request-accept`);

    const denyButton = new ButtonBuilder()
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`ban-request-deny`);

    const disregardButton = new ButtonBuilder()
      .setLabel('Disregard')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`ban-request-disregard`);

    const userInfoButton = new ButtonBuilder()
      .setLabel('User Info')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`user-info-${target.id}`);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
      acceptButton,
      denyButton,
      disregardButton,
      userInfoButton
    );

    const webhook = new WebhookClient({ url: config.banRequestsWebhook! });

    const content =
      config.banRequestsPingRoles.length > 0
        ? config.banRequestsPingRoles.map(r => roleMention(r)).join(', ')
        : undefined;

    const log = await webhook.send({
      content,
      embeds: [embed],
      components: [actionRow],
      allowedMentions: { parse: ['roles'] }
    });

    if (!log) {
      return {
        error: 'Failed to submit the ban request.',
        temporary: true
      };
    }

    await prisma.banRequest.create({
      data: {
        id: log.id,
        guildId,
        targetId: target.id,
        requestedBy,
        requestedAt,
        expiresAt,
        reason
      }
    });

    return {
      content: `Successfully submitted a ban request for ${target} - ID \`#${log.id}\``
    };
  }

  /**
   * Handle a mute request action.
   *
   * @param data.interaction The interaction that triggered the action
   * @param data.config The guild configuration
   * @param data.action The action to take
   * @param data.request The request to handle
   * @param data.reason The reason for the action
   *
   */

  public static async handleMuteRequestAction(data: {
    interaction: ButtonInteraction<'cached'> | ModalSubmitInteraction<'cached'>;
    config: GuildConfig;
    action: 'accept' | 'deny';
    request: MuteRequest;
    reason: string | null;
  }): Promise<InteractionReplyData | null> {
    const { interaction, config, action, request, reason } = data;

    const targetMember = await interaction.guild!.members.fetch(request.targetId).catch(() => null);

    const embed = new EmbedBuilder(interaction.message!.embeds[0] as EmbedData)
      .setAuthor({ name: `Mute Request - ID #${request.id}` })
      .setTimestamp();

    switch (action) {
      case 'accept': {
        if (!targetMember) {
          return {
            error: 'Failed to fetch the target member. Request cannot be accepted.',
            temporary: true
          };
        }

        if (targetMember.isCommunicationDisabled()) {
          return {
            error: 'The target member is already muted. Unmute them before accepting this request.',
            temporary: true
          };
        }

        let failed = false;

        await InfractionManager.resolvePunishment({
          guild: interaction.guild,
          target: targetMember,
          executor: interaction.member!,
          action: 'Mute',
          reason: request.reason,
          duration: Number(request.expiresAt - request.requestedAt)
        }).catch(() => (failed = true));

        if (failed) {
          return {
            error: 'Failed to mute the target member.',
            temporary: true
          };
        }

        const infraction = await InfractionManager.storeInfraction({
          id: InfractionManager.generateInfractionId(),
          guildId: request.guildId,
          targetId: request.targetId,
          executorId: interaction.user.id,
          type: 'Mute',
          reason: request.reason,
          createdAt: Date.now(),
          expiresAt: request.expiresAt
        });

        await TaskManager.storeTask({
          guildId: request.guildId,
          targetId: request.targetId,
          infractionId: infraction.id,
          expiresAt: request.expiresAt,
          type: 'Mute'
        });

        InfractionManager.logInfraction({ config, infraction });
        InfractionManager.sendNotificationDM({ config, infraction, guild: interaction.guild, target: targetMember });

        await prisma.muteRequest.update({
          where: { id: request.id },
          data: {
            status: 'Accepted',
            resolvedBy: interaction.user.id,
            resolvedAt: Date.now()
          }
        });

        await RequestUtils.sendLog({
          config,
          embed,
          action: 'Accepted',
          userId: interaction.user.id,
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully accepted the mute request for ${targetMember} - ID \`#${request.id}\``,
          temporary: true
        };
      }

      case 'deny': {
        await prisma.muteRequest.update({
          where: { id: request.id },
          data: {
            status: 'Denied',
            resolvedBy: interaction.user.id,
            resolvedAt: Date.now()
          }
        });

        await RequestUtils.sendLog({
          config,
          embed,
          action: 'Denied',
          userId: interaction.user.id,
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully denied the mute request for ${userMention(request.targetId)} - ID \`#${request.id}\``,
          temporary: true
        };
      }
    }
  }

  /**
   * Build the modal required to accept or deny a request.
   *
   * @param data.requestId The request ID
   * @param data.type The type of request
   * @param data.action The action to take
   * @returns The modal builder
   */

  public static buildModal(data: { requestId: Snowflake; type: 'mute' | 'ban'; action: 'accept' | 'deny' }) {
    const { requestId, type, action } = data;

    const reasonText = new TextInputBuilder()
      .setCustomId(`reason`)
      .setLabel('Reason')
      .setPlaceholder(`Enter the reason for ${action === 'accept' ? 'accepting' : 'denying'} this request`)
      .setRequired(true)
      .setMaxLength(1024)
      .setStyle(TextInputStyle.Paragraph);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().setComponents(reasonText);

    return new ModalBuilder()
      .setCustomId(`${type}-request-${action}-${requestId}`)
      .setTitle(`${capitalize(action)} Request`)
      .setComponents(actionRow);
  }

  /**
   * Send a log to the request logging webhook.
   *
   * @param data.config The guild configuration
   * @param data.embed The embed to send
   * @param data.userId The user ID who triggered the action
   * @param data.action The action taken
   * @param data.reason The reason for the action
   * @returns The log
   */

  public static async sendLog(data: {
    config: GuildConfig;
    embed: EmbedBuilder;
    userId: Snowflake;
    action: string;
    reason: string;
  }) {
    const { config, embed, userId, action, reason } = data;

    if (!config.requestLoggingEnabled || !config.requestLoggingWebhook) {
      return;
    }

    return new WebhookClient({ url: config.requestLoggingWebhook })
      .send({
        content: `${action} by ${userMentionWithId(userId)} - ${reason.replaceAll('`', '')}`,
        embeds: [embed],
        allowedMentions: { parse: [] }
      })
      .catch(() => null);
  }
}
