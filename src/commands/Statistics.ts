import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  time,
  TimestampStyles
} from 'discord.js';
import { cpus, uptime, type CpuInfo } from 'os';

import ms from 'ms';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Statistics extends Command {
  constructor() {
    super({
      category: CommandCategory.Developer,
      guarded: true,
      data: {
        name: 'statistics',
        description: "Displays the bot's statistics as of the current date.",
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'ephemeral',
            description: 'Whether to send the message as an ephemeral message.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? true;
    /**
     * We query a guild from the database to get a very rough estimate of the database latency.
     */

    await interaction.deferReply({ ephemeral });

    const queryStart = performance.now();
    await this.prisma.guild.findUnique({ where: { id: interaction.guildId } });
    const queryPing = performance.now() - queryStart;

    const [guilds, infractions, messages] = await this.prisma.$transaction([
      this.prisma.guild.count(),
      this.prisma.infraction.count(),
      this.prisma.message.count()
    ]);

    const currentDate = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor(Colors.NotQuiteBlack)
      .setAuthor({ name: 'Statistics', iconURL: this.client.user!.displayAvatarURL() })
      .setThumbnail(this.client.user!.displayAvatarURL())
      .setFields([
        {
          name: 'Client',
          value: `\\- Uptime: \`${ms(this.client.uptime!, {
            long: true
          })}\`\n\\- Cached Guilds: \`${this.client.guilds.cache.size}\`\n\\- Cached Channels: \`${
            this.client.channels.cache.size
          }\`\n\\- Cached Users: \`${this.client.users.cache.size}\``
        },
        {
          name: 'Database',
          value: `\\- Guild Entries: \`${guilds}\`\n\\- Infraction Entries: \`${infractions}\`\n\\- Message Entries: \`${messages}\`\n\\- Heartbeat: \`${queryPing.toFixed(
            2
          )}ms\``
        },
        {
          name: 'Process',
          value: `\\- Uptime: \`${ms(uptime(), { long: true })}\`\n\\- CPU Usage: \`${cpus()
            .map(Statistics._formatCpuInfo.bind(null))
            .join(' | ')}\`\n\\- RSS Memory: \`${Math.floor(
            process.memoryUsage.rss() / 1024 / 1024
          )} MB\`\n\\- Heap Memory: \`${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)} MB\``
        }
      ]);

    return {
      content: `Statistics report as of ${time(currentDate, TimestampStyles.LongDateTime)}.`,
      embeds: [embed]
    };
  }

  private static _formatCpuInfo({ times }: CpuInfo) {
    return `${Math.round(((times.user + times.nice + times.sys + times.irq) / times.idle) * 10000) / 100}%`;
  }
}
