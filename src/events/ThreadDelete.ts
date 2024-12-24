import { APIMessage, Colors, EmbedBuilder, Events, ThreadChannel, WebhookClient } from 'discord.js';

import { channelMentionWithId, userMentionWithId } from '@utils/index';
import { GuildConfig } from '@utils/Types';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@terabyte/EventListener';
import ThreadCreate from './ThreadCreate';

export default class ThreadDelete extends EventListener {
  constructor() {
    super(Events.ThreadDelete);
  }

  async execute(thread: ThreadChannel) {
    if (terabyte.maintenance) return;

    const config = await DatabaseManager.getGuildEntry(thread.guildId);
    const channelIds = ThreadCreate._getChannelIds(thread);

    if (!config.thread_logging_enabled || !config.thread_logging_webhook) return;
    if (config.thread_logging_ignored_channels.some(id => channelIds.includes(id))) return;

    return ThreadDelete._log(thread, config);
  }

  private static async _log(thread: ThreadChannel, config: GuildConfig): Promise<APIMessage | null> {
    if (!thread.ownerId || !thread.parent) return null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Thread Deleted' })
      .setColor(Colors.Red)
      .setFields([
        {
          name: 'Owner',
          value: userMentionWithId(thread.ownerId)
        },
        {
          name: 'Parent',
          value: channelMentionWithId(thread.parent.id)
        },
        {
          name: 'Thread',
          value: `\`#${thread.name}\``
        }
      ])
      .setFooter({ text: `Thread ID: ${thread.id}` })
      .setTimestamp();

    return new WebhookClient({ url: config.thread_logging_webhook! }).send({ embeds: [embed] }).catch(() => null);
  }
}
