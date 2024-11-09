import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildMember,
  roleMention,
  Snowflake,
  User,
  WebhookClient
} from 'discord.js';

import ms from 'ms';

import { GuildConfig, InteractionReplyData } from './Types';
import { userMentionWithId } from '.';
import { prisma } from '..';

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
}
