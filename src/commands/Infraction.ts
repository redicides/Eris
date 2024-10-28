import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  EmbedField,
  InteractionReplyOptions,
  Snowflake,
  time,
  User
} from 'discord.js';
import { InfractionFlag, Infraction as Inf } from '@prisma/client';

import { elipsify, userMentionWithId } from '@utils/index';
import { InteractionReplyData } from '@utils/Types';
import { client, prisma } from '@/index';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { INFRACTIONS_PER_PAGE } from '@managers/database/InfractionManager';

export default class Infraction extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      data: {
        name: 'infraction',
        description: 'Manage infractions.',
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
                  { name: 'Native', value: InfractionFlag.Native },
                  { name: 'Quick', value: InfractionFlag.Quick }
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
                type: ApplicationCommandOptionType.Integer,
                required: true
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const subcommand = interaction.options.getSubcommand() as InfracionSubcommand;

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

        return Infraction.search({
          guildId: interaction.guildId,
          target,
          filter,
          page: 1
        });
      }
      case InfracionSubcommand.Info: {
        const infractionId = interaction.options.getInteger('id', true);

        return Infraction.info({ id: infractionId, guildId: interaction.guildId });
      }
    }
  }

  /**
   * Search a user for infractions.
   *
   * @param data.guildId The guild ID.
   * @param data.target The target user.
   * @param data.filter The filter to apply.
   * @param data.page The page number.
   * @returns Search results.
   */

  public static async search(data: {
    guildId: Snowflake;
    target: User;
    filter: InfractionFlag | null;
    page: number;
  }): Promise<InteractionReplyOptions> {
    const { guildId, target, filter, page } = data;

    const skipMultiplier = page - 1;

    const [infractions, infractionCount] = await prisma.$transaction([
      prisma.infraction.findMany({
        where: {
          guildId,
          targetId: target.id,
          flag: filter ?? undefined
        },
        skip: skipMultiplier * INFRACTIONS_PER_PAGE,
        take: INFRACTIONS_PER_PAGE,
        orderBy: {
          createdAt: 'desc'
        }
      }),

      prisma.infraction.count({
        where: {
          guildId,
          targetId: target.id,
          flag: filter ?? undefined
        }
      })
    ]);

    const embed = new EmbedBuilder()
      .setColor(Colors.NotQuiteBlack)
      .setAuthor({
        name: `${filter ? `${filter} ` : ''}Infractions for @${target.username}`,
        iconURL: target.displayAvatarURL()
      })
      // Infraction pagination relies on this format
      .setFooter({ text: `User ID: ${target.id}` });

    const fields = await Infraction._getSearchFields(infractions);

    if (!fields.length) {
      embed.setDescription('No infractions found.');
    } else {
      embed.setFields(fields);
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (infractionCount > INFRACTIONS_PER_PAGE) {
      const totalPages = Math.ceil(infractionCount / INFRACTIONS_PER_PAGE);
      const paginationActionRow = Infraction._getPaginationButtons({
        page,
        totalPages
      });

      components.push(paginationActionRow);
    }

    return { embeds: [embed], components, ephemeral: true };
  }

  /**
   * Get detailed information about an infraction.
   * @param data.id The infraction ID.
   * @param data.guildId The guild ID.
   * @returns Infraction details.
   */

  public static async info(data: { id: number; guildId: Snowflake }): Promise<InteractionReplyData> {
    const { id, guildId } = data;

    const infraction = await prisma.infraction.findUnique({
      where: {
        id,
        guildId
      }
    });

    if (!infraction) {
      return {
        error: 'The infraction could not be found.',
        temporary: true
      };
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} #${infraction.id}` })
      .setColor(InfractionManager.mapActionToColor({ infraction }))
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executorId) },
        { name: 'Target', value: userMentionWithId(infraction.targetId) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.createdAt));

    if (infraction.expiresAt)
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expiresAt)
      });

    return { embeds: [embed], ephemeral: true };
  }

  private static async _getSearchFields(infractions: Inf[]) {
    let fields: EmbedField[] = [];

    for (const infraction of infractions) {
      const executor = await client.users.fetch(infraction.executorId).catch(() => null);

      fields.push({
        name: `${infraction.type} #${infraction.id} - Issued by ${
          executor ? `@${executor.username}` : 'an unknown user'
        }`,
        value: `${elipsify(infraction.reason, 256)} - ${time(Math.floor(Number(infraction.createdAt) / 1000))}`,
        inline: false
      });

      continue;
    }

    return fields;
  }

  private static _getPaginationButtons(data: { page: number; totalPages: number }) {
    const { page, totalPages } = data;

    const isFirstPage = page === 1;
    const isLastPage = page === totalPages;

    const pageCountButton = new ButtonBuilder()
      .setLabel(`${page} / ${totalPages}`)
      .setCustomId('?')
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary);

    const nextButton = new ButtonBuilder()
      .setLabel('→')
      .setCustomId(`infraction-search-next`)
      .setDisabled(isLastPage)
      .setStyle(ButtonStyle.Primary);

    const previousButton = new ButtonBuilder()
      .setLabel('←')
      .setCustomId(`infraction-search-back`)
      .setDisabled(isFirstPage)
      .setStyle(ButtonStyle.Primary);

    if (totalPages > 2) {
      const firstPageButton = new ButtonBuilder()
        .setLabel('«')
        .setCustomId(`infraction-search-first`)
        .setDisabled(isFirstPage)
        .setStyle(ButtonStyle.Primary);

      const lastPageButton = new ButtonBuilder()
        .setLabel('»')
        .setCustomId(`infraction-search-last`)
        .setDisabled(isLastPage)
        .setStyle(ButtonStyle.Primary);

      return new ActionRowBuilder<ButtonBuilder>().setComponents(
        firstPageButton,
        previousButton,
        pageCountButton,
        nextButton,
        lastPageButton
      );
    } else {
      return new ActionRowBuilder<ButtonBuilder>().setComponents(previousButton, pageCountButton, nextButton);
    }
  }
}

enum InfracionSubcommand {
  Search = 'search',
  Info = 'info'
}
