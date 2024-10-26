import {
  ActionRowBuilder,
  APIMessage,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  channelMention,
  cleanContent,
  Colors,
  EmbedBuilder,
  EmbedData,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  roleMention,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  User,
  WebhookClient
} from 'discord.js';

import { client, prisma } from '@/index';
import { GuildConfig, InteractionReplyData } from './Types';
import { capitalize, cropLines, formatMessageContentForShortLog, userMentionWithId } from './index';
import { MessageReport, UserReport } from '@prisma/client';
import { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';

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
    const primaryRow = new ActionRowBuilder<ButtonBuilder>();
    const secondaryRow = new ActionRowBuilder<ButtonBuilder>();

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

    const deleteMessageButton = new ButtonBuilder()
      .setCustomId(`delete-message-${message.channel.id}-${message.id}`)
      .setLabel('Delete Message')
      .setStyle(ButtonStyle.Secondary);

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

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (reference) {
      const deleteReferenceButton = new ButtonBuilder()
        .setCustomId(`delete-message-${reference.channel.id}-${reference.id}`)
        .setLabel('Delete Reference')
        .setStyle(ButtonStyle.Secondary);

      primaryRow.setComponents(acceptButton, denyButton, disregardButton, userInfoButton);
      secondaryRow.setComponents(deleteMessageButton, deleteReferenceButton);

      components.push(primaryRow, secondaryRow);
    } else {
      primaryRow.setComponents(acceptButton, denyButton, disregardButton, deleteMessageButton, userInfoButton);
      components.push(primaryRow);
    }

    const content =
      config.messageReportsPingRoles.length > 0
        ? config.messageReportsPingRoles.map(r => roleMention(r)).join(', ')
        : undefined;

    const webhook = new WebhookClient({ url: config.messageReportsWebhook! });
    const log = await webhook
      .send({
        content,
        embeds,
        components,
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

  /**
   * Handle a user report action.
   *
   * @param data The data for the action
   * @returns The interaction reply data
   */

  public static async handleMessageReportAction(data: {
    interaction: ModalSubmitInteraction<'cached'> | ButtonInteraction<'cached'>;
    config: GuildConfig;
    action: 'accept' | 'deny';
    report: MessageReport;
    reason: string | null;
  }): Promise<InteractionReplyData> {
    const { interaction, config, action, report, reason } = data;

    const user = await client.users.fetch(report.reportedBy).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(action === 'accept' ? Colors.Green : Colors.Red)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
      .setTitle(`Message Report ${action === 'accept' ? 'Accepted' : 'Denied'}`)
      .setFields([{ name: 'Reported Message', value: `${report.messageUrl} (\`${report.messageId}\`)` }])
      .setFooter({ text: `Report ID: #${report.id}` })
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: 'Reviewer Reason', value: reason });
    }

    const components = interaction.message?.components!.length;

    const log = new EmbedBuilder(interaction.message!.embeds[components === 1 ? 0 : 1] as EmbedData)
      .setAuthor({ name: 'Message Report' })
      .setFooter({ text: `Report ID: #${report.id}` })
      .setTimestamp();

    switch (action) {
      case 'accept': {
        await prisma.messageReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Accepted'
          }
        });

        if (user && config.messageReportsNotifyStatus) {
          await user.send({ embeds: [embed] }).catch(() => null);
        }

        let failed = false;
        await interaction.message?.delete().catch(() => (failed = true));

        await ReportUtils.sendLog({
          config,
          embed: log,
          userId: interaction.user.id,
          action: 'Accepted',
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        return {
          content: `Successfully accepted the report ${
            failed ? 'but could not delete the alert' : 'and deleted the alert'
          } - ID \`#${report.id}\``,
          temporary: true
        };
      }

      case 'deny': {
        await prisma.messageReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Denied'
          }
        });

        if (user && config.messageReportsNotifyStatus) {
          await user.send({ embeds: [embed] }).catch(() => null);
        }

        let failed = false;
        await interaction.message?.delete().catch(() => (failed = true));

        await ReportUtils.sendLog({
          config,
          embed: log,
          userId: interaction.user.id,
          action: 'Denied',
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        return {
          content: `Successfully denied the report ${
            failed ? 'but could not delete the alert' : 'and deleted the alert'
          } - ID \`#${report.id}\``,
          temporary: true
        };
      }
    }
  }

  /**
   * Handle a user report action.
   *
   * @param data The data for the action
   * @returns The interaction reply data
   */

  public static async handleUserReportAction(data: {
    interaction: ModalSubmitInteraction<'cached'> | ButtonInteraction<'cached'>;
    config: GuildConfig;
    action: 'accept' | 'deny';
    report: UserReport;
    reason: string | null;
  }): Promise<InteractionReplyData> {
    const { interaction, config, action, report, reason } = data;

    const user = await client.users.fetch(report.reportedBy).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(action === 'accept' ? Colors.Green : Colors.Red)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
      .setTitle(`User Report ${action === 'accept' ? 'Accepted' : 'Denied'}`)
      .setFields([{ name: 'Reported User', value: userMentionWithId(report.targetId) }])
      .setFooter({ text: `Report ID: #${report.id}` })
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: 'Reviewer Reason', value: reason });
    }

    const components = interaction.message?.components!.length;

    const log = new EmbedBuilder(interaction.message!.embeds[components === 1 ? 0 : 1] as EmbedData)
      .setAuthor({ name: 'User Report' })
      .setFooter({ text: `Report ID: #${report.id}` })
      .setTimestamp();

    switch (action) {
      case 'accept': {
        await prisma.userReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Accepted'
          }
        });

        if (user && config.userReportsNotifyStatus) {
          await user.send({ embeds: [embed] }).catch(() => null);
        }

        let failed = false;
        await interaction.message?.delete().catch(() => (failed = true));

        await ReportUtils.sendLog({
          config,
          embed: log,
          userId: interaction.user.id,
          action: 'Accepted',
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        return {
          content: `Successfully accepted the report ${
            failed ? 'but could not delete the alert' : 'and deleted the alert'
          } - ID \`#${report.id}\``,
          temporary: true
        };
      }

      case 'deny': {
        await prisma.userReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Denied'
          }
        });

        if (user && config.userReportsNotifyStatus) {
          await user.send({ embeds: [embed] }).catch(() => null);
        }

        let failed = false;
        await interaction.message?.delete().catch(() => (failed = true));

        await ReportUtils.sendLog({
          config,
          embed: log,
          userId: interaction.user.id,
          action: 'Denied',
          reason: reason ?? DEFAULT_INFRACTION_REASON
        });

        return {
          content: `Successfully denied the report ${
            failed ? 'but could not delete the alert' : 'and deleted the alert'
          } - ID \`#${report.id}\``,
          temporary: true
        };
      }
    }
  }

  /**
   * Build the modal required for accepting or denying a report.
   *
   * @param data The data for the modal
   * @returns The modal builder
   */

  public static buildModal(data: {
    action: 'accept' | 'deny';
    reportType: 'user' | 'message';
    reportId: string;
  }): ModalBuilder {
    const { action, reportType, reportId } = data;

    const reasonText = new TextInputBuilder()
      .setCustomId(`reason`)
      .setLabel('Reason')
      .setPlaceholder(`Enter the reason for ${action === 'accept' ? 'accepting' : 'denying'} this report`)
      .setRequired(true)
      .setMaxLength(1024)
      .setStyle(TextInputStyle.Paragraph);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().setComponents(reasonText);

    return new ModalBuilder()
      .setCustomId(`${reportType}-report-${action}-${reportId}`)
      .setTitle(`${capitalize(action)} Report`)
      .setComponents(actionRow);
  }

  /**
   * Send a log to the report logging webhook.
   *
   * @param data The data for the log
   * @returns
   */

  public static async sendLog(data: {
    config: GuildConfig;
    embed: EmbedBuilder;
    userId: Snowflake;
    action: string;
    reason: string;
  }): Promise<APIMessage | null> {
    const { config, embed, action, userId, reason } = data;

    if (!config.reportLoggingEnabled || !config.reportLoggingWebhook) return null;

    const webhook = new WebhookClient({ url: config.reportLoggingWebhook });
    const parsedReason = reason.replaceAll('`', '');

    return webhook
      .send({
        content: `${action} by ${userMentionWithId(userId)} - ${parsedReason}`,
        embeds: [embed],
        allowedMentions: { parse: [] }
      })
      .catch(() => null);
  }
}
