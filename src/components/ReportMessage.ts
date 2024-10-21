import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  cleanContent,
  Colors,
  EmbedBuilder,
  Message,
  ModalSubmitInteraction,
  roleMention,
  TextChannel,
  User,
  WebhookClient
} from 'discord.js';

import { Guild } from '@prisma/client';

import { prisma } from '@/index';
import { InteractionReplyData } from '@utils/Types';
import { cropLines, formatMessageContentForShortLog, userMentionWithId } from '@utils/index';

import Component from '@managers/components/Component';
import CacheManager from '@managers/database/CacheManager';

export default class ReportMessageComponent extends Component {
  constructor() {
    super({ matches: /^report-message-\d{17,19}-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>): Promise<InteractionReplyData> {
    const config = await CacheManager.guilds.get(interaction.guildId);

    if (!config.messageReportsEnabled) {
      return {
        error: 'Message reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.messageReportsBlacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting message reports in this server.',
        temporary: true
      };
    }

    if (!config.messageReportsWebhook) {
      return {
        error: 'Message reports are not configured in this server.',
        temporary: true
      };
    }

    const channelId = interaction.customId.split('-')[2];
    const messageId = interaction.customId.split('-')[3];

    const channel = (await interaction.guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel) {
      return {
        error: `Failed to fetch the channel for message with ID ${messageId}.`,
        temporary: true
      };
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return {
        error: `Failed to fetch the message with ID ${messageId}.`,
        temporary: true
      };
    }

    const target = message.author;
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!target) {
      return {
        error: 'The author of the target message could not be found.',
        temporary: true
      };
    }

    if (!targetMember && config.userReportsRequireMember) {
      return {
        error: 'You cannot report this message because the author is not a member of this server.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.userReportsImmuneRoles.includes(role.id))) {
        return {
          error: 'You cannot report this message.',
          temporary: true
        };
      }
    }

    const reason = interaction.fields.getTextInputValue('report-reason');

    if (!reason.match(/\w/g)) {
      return {
        error: 'You must provide a valid reason for reporting this message.',
        temporary: true
      };
    }

    return ReportMessageComponent._createReport({ interaction, config, target, message, reason });
  }

  private static async _createReport(data: {
    interaction: ModalSubmitInteraction<'cached'>;
    config: Guild;
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
        error: 'Failed to submit the message report...'
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
