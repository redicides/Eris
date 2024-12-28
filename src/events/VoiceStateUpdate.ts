import { APIMessage, Colors, EmbedBuilder, Events, VoiceBasedChannel, VoiceState, WebhookClient } from 'discord.js';

import { GuildConfig } from '@utils/Types';
import { channelMentionWithId, userMentionWithId } from '@utils/index';

import EventListener from '@eris/EventListener';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class VoiceStateUpdate extends EventListener {
  constructor() {
    super(Events.VoiceStateUpdate);
  }

  async execute(oldState: VoiceState, newState: VoiceState) {
    if (eris.maintenance) return;

    // Ignore if the channel ID remains the same (e.g. the user toggled their microphone)
    if (oldState.channelId === newState.channelId) return;

    const channel = newState.channel || oldState.channel;
    const config = await DatabaseManager.getGuildEntry(newState.guild.id);

    if (!channel || !config.voice_logging_enabled || !config.voice_logging_webhook) return;

    const channelIds = VoiceStateUpdate._getChannelIds(channel);
    if (config.voice_logging_ignored_channels.some(id => channelIds.includes(id))) return;

    return VoiceStateUpdate._log(oldState, newState, config);
  }

  private static async _log(
    oldState: VoiceState,
    newState: VoiceState,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    let embed!: EmbedBuilder;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      embed = VoiceStateUpdate._getVoiceJoinLogEmbed(newState);
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      embed = VoiceStateUpdate._getVoiceLeaveLogEmbed(oldState);
    }

    // User switched voice channels
    if (oldState.channelId && newState.channelId) {
      embed = VoiceStateUpdate._getVoiceMoveLogEmbed(oldState, newState);
    }

    return new WebhookClient({ url: config.voice_logging_webhook! }).send({ embeds: [embed] }).catch(() => null);
  }

  private static _getVoiceJoinLogEmbed(newState: VoiceState): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Green)
      .setAuthor({ name: 'Voice Join' })
      .setFields([
        {
          name: 'Member',
          value: userMentionWithId(newState.id)
        },
        {
          name: 'Channel',
          value: channelMentionWithId(newState.channel!.id)
        }
      ])
      .setTimestamp();
  }

  private static _getVoiceLeaveLogEmbed(oldState: VoiceState): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Red)
      .setAuthor({ name: 'Voice Leave' })
      .setFields([
        {
          name: 'Member',
          value: userMentionWithId(oldState.id)
        },
        {
          name: 'Channel',
          value: channelMentionWithId(oldState.channel!.id)
        }
      ])
      .setTimestamp();
  }

  private static _getVoiceMoveLogEmbed(oldState: VoiceState, newState: VoiceState): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setAuthor({ name: 'Voice Switch' })
      .setFields([
        {
          name: 'User',
          value: userMentionWithId(newState.id)
        },
        {
          name: 'Channel (Before)',
          value: channelMentionWithId(oldState.channel!.id)
        },
        {
          name: 'Channel (After)',
          value: channelMentionWithId(newState.channel!.id)
        }
      ])
      .setTimestamp();
  }

  private static _getChannelIds(channel: VoiceBasedChannel): string[] {
    const ids = [channel.id];

    if (channel.parent) ids.push(channel.parent.id);
    if (channel.parent?.parentId) ids.push(channel.parent.parentId);

    return ids;
  }
}
