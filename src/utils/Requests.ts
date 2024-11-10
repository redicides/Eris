import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  EmbedData,
  GuildMember,
  MessageCreateOptions,
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
import { BanRequest, MuteRequest } from '@prisma/client';

import ms from 'ms';

import { GuildConfig, InteractionReplyData } from './Types';
import { capitalize, userMentionWithId } from '.';
import { client, prisma } from '..';

import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';
import ConfigManager from '@managers/config/ConfigManager';

const { error } = ConfigManager.global_config.emojis;

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
        duration,
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
        duration,
        reason
      }
    });

    return {
      content: `Successfully submitted a ban request for ${target} - ID \`#${log.id}\``
    };
  }

  /**
   * Handle a ban request action.
   *
   * @param data.interaction The interaction that triggered the action
   * @param data.config The guild configuration
   * @param data.action The action to take
   * @param data.request The request to handle
   * @param data.reason The reason for the action
   * @returns The interaction reply data
   */

  public static async handleBanRequestAction(data: {
    interaction: ButtonInteraction<'cached'> | ModalSubmitInteraction<'cached'>;
    config: GuildConfig;
    action: 'accept' | 'deny';
    request: BanRequest;
    reason: string | null;
  }): Promise<InteractionReplyData> {
    const { interaction, config, action, request, reason } = data;

    await interaction.deferReply({ ephemeral: true });

    const createdAt = Date.now();
    const expiresAt = request.duration ? createdAt + Number(request.duration) : null;

    const target = await client.users.fetch(request.targetId).catch(() => null);
    const targetMember = await interaction.guild!.members.fetch(request.targetId).catch(() => null);

    const embed = new EmbedBuilder(interaction.message!.embeds[0] as EmbedData)
      .setAuthor({ name: `Ban Request` })
      .setFooter({ text: `Request ID: #${request.id}` })
      .setTimestamp();

    const content = `${action === 'deny' ? `${error} ` : ``}${userMention(
      request.requestedBy
    )}, your ban request against ${userMention(request.targetId)} has been ${
      action === 'accept' ? 'accepted' : 'denied'
    } by ${userMention(interaction.user.id)} - ID \`#${request.id}\``;

    switch (action) {
      case 'accept': {
        if (!target) {
          setTimeout(async () => {
            await interaction.message?.delete().catch(() => null);
          }, 7000);

          return {
            error: 'Failed to fetch the target user. Request cannot be accepted and will be deleted in **7 seconds**.',
            temporary: true
          };
        }

        if (await interaction.guild.bans.fetch(target.id).catch(() => null)) {
          return {
            error: 'The target user is already banned. Unban them before accepting this request.',
            temporary: true
          };
        }

        let failed = false;

        const infraction = await InfractionManager.storeInfraction({
          id: InfractionManager.generateInfractionId(),
          guildId: request.guildId,
          targetId: request.targetId,
          executorId: interaction.user.id,
          type: 'Ban',
          reason: request.reason,
          createdAt,
          expiresAt
        });

        if (targetMember) {
          await InfractionManager.sendNotificationDM({
            guild: interaction.guild,
            config,
            infraction,
            target: targetMember
          });
        }

        await InfractionManager.resolvePunishment({
          guild: interaction.guild,
          executor: interaction.member!,
          action: 'Ban',
          reason: request.reason,
          target: target,
          duration: null
        }).catch(() => (failed = true));

        if (failed) {
          await InfractionManager.deleteInfraction({ id: infraction.id });

          return {
            error: 'Failed to ban the target user. The related infraction has been deleted.',
            temporary: true
          };
        }

        if (expiresAt) {
          await TaskManager.storeTask({
            guildId: request.guildId,
            targetId: request.targetId,
            infractionId: infraction.id,
            expiresAt,
            type: 'Ban'
          });
        } else {
          await TaskManager.deleteTask({
            targetId_guildId_type: { targetId: request.targetId, guildId: request.guildId, type: 'Ban' }
          });
        }

        await InfractionManager.logInfraction({ config, infraction });

        await prisma.banRequest.update({
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

        await RequestUtils.sendNotification({
          config,
          options: { content, allowedMentions: { parse: [] } }
        });

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully accepted the ban request for ${target} - ID \`#${request.id}\``,
          temporary: true
        };
      }

      case 'deny': {
        await prisma.banRequest.update({
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

        await RequestUtils.sendNotification({
          config,
          options: {
            content,
            allowedMentions: { parse: ['users'] }
          }
        });

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully denied the ban request for ${userMention(request.targetId)} - ID \`#${request.id}\``,
          temporary: true
        };
      }
    }
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

    await interaction.deferReply({ ephemeral: true });

    const createdAt = Date.now();
    const expiresAt = createdAt + request.duration;

    const targetMember = await interaction.guild!.members.fetch(request.targetId).catch(() => null);

    const embed = new EmbedBuilder(interaction.message!.embeds[0] as EmbedData)
      .setAuthor({ name: `Mute Request` })
      .setFooter({ text: `Request ID: #${request.id}` })
      .setTimestamp();

    const content = `${action === 'deny' ? `${error} ` : ``}${userMention(
      request.requestedBy
    )}, your mute request against ${userMention(request.targetId)} has been ${
      action === 'accept' ? 'accepted' : 'denied'
    } by ${userMention(interaction.user.id)} - ID \`#${request.id}\``;

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
          duration: request.duration
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
          createdAt,
          expiresAt
        });

        await TaskManager.storeTask({
          guildId: request.guildId,
          targetId: request.targetId,
          infractionId: infraction.id,
          expiresAt,
          type: 'Mute'
        });

        await InfractionManager.logInfraction({ config, infraction });
        await InfractionManager.sendNotificationDM({
          config,
          infraction,
          guild: interaction.guild,
          target: targetMember
        });

        await prisma.muteRequest.update({
          where: { id: request.id },
          data: {
            status: 'Accepted',
            resolvedBy: interaction.user.id,
            resolvedAt: createdAt
          }
        });

        await RequestUtils.sendLog({
          config,
          embed,
          action: 'Accepted',
          userId: interaction.user.id,
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        await RequestUtils.sendNotification({
          config,
          options: { content, allowedMentions: { parse: [] } }
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
            resolvedAt: createdAt
          }
        });

        await RequestUtils.sendLog({
          config,
          embed,
          action: 'Denied',
          userId: interaction.user.id,
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        await RequestUtils.sendNotification({
          config,
          options: {
            content,
            allowedMentions: { parse: ['users'] }
          }
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

  /**
   * Send a notification to the notification webhook.
   *
   * @param data.config The guild configuration
   * @param data.options The message options
   * @returns The notification
   */

  public static async sendNotification(data: { config: GuildConfig; options: MessageCreateOptions }) {
    const { config, options } = data;

    if (!config.notificationWebhook) {
      return;
    }

    return new WebhookClient({ url: config.notificationWebhook }).send(options).catch(() => null);
  }
}
