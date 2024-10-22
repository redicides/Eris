import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  channelMention,
  cleanContent,
  Colors,
  EmbedBuilder,
  Message,
  ModalSubmitInteraction,
  roleMention,
  User,
  WebhookClient
} from 'discord.js';

import { prisma } from '@/index';
import { GuildConfig, InteractionReplyData } from './Types';
import { cropLines, formatMessageContentForShortLog, userMentionWithId } from './index';

export class ReportUtils {
  /**
   * Create a user report.
   *
   * @param data The data for the report
   * @returns The interaction reply data
   */

  public static async createUserReport(data: {
    interaction: ModalSubmitInteraction<'cached'>;
    config: GuildConfig;
    target: User;
    reason: string;
  }): Promise<InteractionReplyData> {
    const { interaction, config, target, reason } = data;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'New User Report' })
      .setColor(Colors.Blue)
      .setFields([
        {
          name: 'Reported By',
          value: userMentionWithId(interaction.user.id)
        },
        {
          name: 'Report Target',
          value: userMentionWithId(target.id)
        },
        {
          name: 'Report Reason',
          value: reason
        }
      ])
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    if (interaction.channelId) {
      // Add the channel field after the "Reported By" field
      embed.spliceFields(1, 0, {
        name: 'Source Channel',
        value: `${channelMention(interaction.channelId)} (\`${interaction.channelId}\`)`
      });
    }

    const acceptButton = new ButtonBuilder()
      .setCustomId(`user-report-accept`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId('user-report-deny')
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger);

    const disregardButton = new ButtonBuilder()
      .setCustomId('user-report-disregard')
      .setLabel('Disregard')
      .setStyle(ButtonStyle.Secondary);

    const userInfoButton = new ButtonBuilder()
      .setCustomId(`user-info-${target.id}`)
      .setLabel('User Info')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
      acceptButton,
      denyButton,
      disregardButton,
      userInfoButton
    );

    const content =
      config.userReportsPingRoles.length > 0
        ? config.userReportsPingRoles.map(r => roleMention(r)).join(', ')
        : undefined;

    const webhook = new WebhookClient({ url: config.userReportsWebhook! });
    const log = await webhook
      .send({ content, embeds: [embed], components: [actionRow], allowedMentions: { parse: ['roles'] } })
      .catch(() => null);

    if (!log) {
      return {
        error: 'Failed to submit the user report.'
      };
    }

    await prisma.userReport.create({
      data: {
        id: log.id,
        guildId: interaction.guildId,
        targetId: target.id,
        reportedBy: interaction.user.id,
        reportedAt: Date.now(),
        reportReason: reason
      }
    });

    return {
      content: `Successfully submitted a report for ${target} - ID \`#${log.id}\``
    };
  }

  /**
   * Create a message report.
   * @param data The data for the report
   * @returns The interaction reply data
   */

  static async createMessageReport(data: {
    interaction: ModalSubmitInteraction<'cached'>;
    config: GuildConfig;
    target: User;
    message: Message;
    reason: string;
  }): Promise<InteractionReplyData> {
    const { interaction, config, target, message, reason } = data;

    const msgContent = cleanContent(message.content, message.channel);
    const croppedContent = cropLines(msgContent, 5);
    const stickerId = message.stickers.first()?.id ?? null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'New Message Report' })
      .setColor(Colors.Blue)
      .setThumbnail(target.displayAvatarURL())
      .setFields([
        {
          name: 'Reported By',
          value: userMentionWithId(interaction.user.id)
        },
        {
          name: 'Report Reason',
          value: reason
        },
        {
          name: 'Message Author',
          value: userMentionWithId(target.id)
        },
        {
          name: 'Message Content',
          value: await formatMessageContentForShortLog(croppedContent, stickerId, message.url)
        }
      ])
      .setTimestamp();

    const reference = message.reference && (await message.fetchReference().catch(() => null));

    const embeds: EmbedBuilder[] = [];

    if (reference) {
      const referenceContent = cleanContent(reference.content, reference.channel);
      const croppedReferenceContent = cropLines(referenceContent, 5);

      const referenceEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Message Reference' })
        .setColor(Colors.NotQuiteBlack)
        .setFields([
          {
            name: 'Reference Author',
            value: userMentionWithId(reference.author.id)
          },
          {
            name: 'Reference Content',
            value: await formatMessageContentForShortLog(
              croppedReferenceContent,
              reference.stickers.first()?.id ?? null,
              reference.url
            )
          }
        ])
        .setTimestamp();

      embeds.push(referenceEmbed);
    }

    embeds.push(embed);

    const acceptButton = new ButtonBuilder()
      .setCustomId(`message-report-accept`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId('message-report-deny')
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger);

    const disregardButton = new ButtonBuilder()
      .setCustomId('message-report-disregard')
      .setLabel('Disregard')
      .setStyle(ButtonStyle.Secondary);

    const userInfoButton = new ButtonBuilder()
      .setCustomId(`user-info-${target.id}`)
      .setLabel('User Info')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(
      acceptButton,
      denyButton,
      disregardButton,
      userInfoButton
    );
    const content =
      config.messageReportsPingRoles.length > 0
        ? config.messageReportsPingRoles.map(r => roleMention(r)).join(', ')
        : undefined;

    const webhook = new WebhookClient({ url: config.messageReportsWebhook! });
    const log = await webhook
      .send({
        content,
        embeds,
        components: [actionRow],
        allowedMentions: { parse: ['roles'] }
      })
      .catch(() => null);

    if (!log) {
      return {
        error: 'Failed to submit the message report.'
      };
    }

    await prisma.messageReport.create({
      data: {
        id: log.id,
        guildId: interaction.guildId,
        messageId: message.id,
        messageUrl: message.url,
        channelId: message.channel.id,
        authorId: message.author.id,
        content: content,
        reportedBy: interaction.user.id,
        reportedAt: Date.now(),
        reportReason: reason
      }
    });

    return {
      content: `Successfully submitted a report for ${target}'s message - ID \`#${log.id}\``
    };
  }
}
