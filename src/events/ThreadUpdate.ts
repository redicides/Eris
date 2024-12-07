import { APIMessage, Colors, EmbedBuilder, Events, ThreadChannel, WebhookClient } from 'discord.js';

import { channelMentionWithId, getObjectDiff, userMentionWithId, capitalize } from '@utils/index';
import { GuildConfig } from '@utils/Types';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import ThreadCreate from './ThreadCreate';

export default class ThreadUpdate extends EventListener {
  constructor() {
    super(Events.ThreadUpdate);
  }

  async execute(oldThread: ThreadChannel, newThread: ThreadChannel) {
    const config = await DatabaseManager.getGuildEntry(newThread.guildId);
    const channelIds = ThreadCreate._getChannelIds(newThread);

    if (!config.thread_logging_enabled || !config.thread_logging_webhook) return;
    if (config.thread_logging_ignored_channels.some(id => channelIds.includes(id))) return;

    return ThreadUpdate._log(oldThread, newThread, config);
  }

  private static async _log(
    oldThread: ThreadChannel,
    newThread: ThreadChannel,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!newThread.ownerId || !newThread.parent) return null;

    const difference = getObjectDiff(oldThread, newThread);
    const changes: string[] = [];

    for (const [prop, diff] of Object.entries(difference)) {
      changes.push(`${capitalize(prop)}\n └ \`${diff.old}\` → \`${diff.new}\`\n`);
    }

    if (!changes.length) return null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Thread Updated' })
      .setColor(Colors.Yellow)
      .setFields([
        {
          name: 'Owner',
          value: userMentionWithId(newThread.ownerId)
        },
        {
          name: 'Parent',
          value: channelMentionWithId(newThread.parent.id)
        },
        {
          name: 'Thread',
          value: channelMentionWithId(newThread.id)
        },
        {
          name: 'Changes',
          value: changes.join('\n')
        }
      ])
      .setFooter({ text: `Thread ID: ${newThread.id}` })
      .setTimestamp();

    return new WebhookClient({ url: config.thread_logging_webhook! }).send({ embeds: [embed] }).catch(() => null);
  }
}
