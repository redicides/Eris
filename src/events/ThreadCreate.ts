import { APIMessage, Colors, EmbedBuilder, Events, ThreadChannel, WebhookClient } from 'discord.js';

import { channelMentionWithId, userMentionWithId } from '@utils/index';
import { GuildConfig } from '@utils/Types';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@terabyte/EventListener';

export default class ThreadCreate extends EventListener {
  constructor() {
    super(Events.ThreadCreate);
  }

  async execute(thread: ThreadChannel) {
    const config = await DatabaseManager.getGuildEntry(thread.guildId);
    const channelIds = ThreadCreate._getChannelIds(thread);

    if (!config.thread_logging_enabled || !config.thread_logging_webhook) return;
    if (config.thread_logging_ignored_channels.some(id => channelIds.includes(id))) return;

    return ThreadCreate._log(thread, config);
  }

  private static async _log(thread: ThreadChannel, config: GuildConfig): Promise<APIMessage | null> {
    if (!thread.ownerId || !thread.parent) return null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Thread Created' })
      .setColor(Colors.Blue)
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
          value: channelMentionWithId(thread.id)
        }
      ])
      .setFooter({ text: `Thread ID: ${thread.id}` })
      .setTimestamp();

    return new WebhookClient({ url: config.thread_logging_webhook! }).send({ embeds: [embed] }).catch(() => null);
  }

  public static _getChannelIds(thread: ThreadChannel): string[] {
    const ids = [thread.id];

    if (thread.parent) ids.push(thread.parent.id);
    if (thread.parent?.parentId) ids.push(thread.parent.parentId);

    return ids;
  }
}
