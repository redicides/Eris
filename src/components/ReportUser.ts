import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  channelMention,
  Colors,
  EmbedBuilder,
  ModalSubmitInteraction,
  roleMention,
  User,
  WebhookClient
} from 'discord.js';

import { prisma } from '@/index';
import { userMentionWithId } from '@utils/index';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Component from '@managers/components/Component';
import CacheManager from '@managers/database/CacheManager';

export default class ReportUserComponent extends Component {
  constructor() {
    super({ matches: /^report-user-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>): Promise<InteractionReplyData> {
    const config = await CacheManager.guilds.get(interaction.guildId);

    if (!config.userReportsEnabled) {
      return {
        error: 'User reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.userReportsBlacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting user reports in this server.',
        temporary: true
      };
    }

    if (!config.userReportsWebhook) {
      return {
        error: 'User reports are not configured in this server.',
        temporary: true
      };
    }

    const targetId = interaction.customId.split('-')[2];

    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    const target = targetMember?.user ?? (await interaction.client.users.fetch(targetId).catch(() => null));

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    if (!targetMember && config.userReportsRequireMember) {
      return {
        error: 'You cannot report this user because they are not a member of this server.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.userReportsImmuneRoles.includes(role.id))) {
        return {
          error: 'You cannot report this user.',
          temporary: true
        };
      }
    }

    const reason = interaction.fields.getTextInputValue('report-reason');

    if (!reason.match(/\w/g)) {
      return {
        error: 'You must provide a valid reason for reporting this user.',
        temporary: true
      };
    }

    return ReportUserComponent._createReport({ interaction, config, target, reason });
  }

  private static async _createReport(data: {
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
        value: channelMention(interaction.channelId)
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
        ? config.userReportsPingRoles.map(r => `${roleMention(r)}`).join(', ')
        : undefined;

    const webhook = new WebhookClient({ url: config.userReportsWebhook! });
    const log = await webhook
      .send({ content, embeds: [embed], components: [actionRow], allowedMentions: { parse: ['roles'] } })
      .catch(() => null);

    if (!log) {
      return {
        error: 'Failed to submit the user report...'
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
}
