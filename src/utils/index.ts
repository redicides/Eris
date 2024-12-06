import {
  AutocompleteInteraction,
  codeBlock,
  Colors,
  CommandInteraction,
  Message as DiscordMessage,
  EmbedField,
  escapeCodeBlock,
  GuildMember,
  hyperlink,
  Interaction,
  InteractionReplyOptions,
  Snowflake,
  SnowflakeUtil,
  StickerFormatType,
  TextBasedChannel,
  cleanContent as djsCleanContent,
  GuildTextBasedChannel,
  EmbedBuilder,
  messageLink,
  channelMention,
  ChatInputApplicationCommandData,
  ApplicationCommandOptionType,
  WebhookClient,
  MessageCreateOptions,
  APIMessage
} from 'discord.js';
import { PermissionEnum, Message, Shortcut } from '@prisma/client';

import YAML from 'yaml';
import fs from 'fs';
import ms from 'ms';

import { client } from '..';
import { EMPTY_MESSAGE_CONTENT, LOG_ENTRY_DATE_FORMAT } from './Constants';
import { GuildConfig, InteractionReplyData, MessageLog } from './Types';
import { ComponentInteraction } from '@managers/components/Component';
import { CommandCategory } from '@managers/commands/Command';

import ConfigManager from '@managers/config/ConfigManager';
import CommandManager from '@managers/commands/CommandManager';
import DatabaseManager from '@managers/database/DatabaseManager';

/**
 * Pluralizes a word based on the given count
 *
 * @param count The count used to determine the plural form
 * @param singular The singular form of the word
 * @param plural The plural form of the word, defaults to `{singular}s`
 * @returns The pluralized word
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/**
 * Wait a certain amount of time before proceeding with the next step
 *
 * @param ms The amount of time to wait in milliseconds
 * @returns A promise that resolves after the specified time has elapsed
 */

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reads a YAML file from the given path and returns the parsed content.
 *
 * @param path - The path to the YAML file.
 * @template T - The type of the parsed content.
 * @returns {T} The parsed content of the YAML file.
 */

export function readYamlFile<T>(path: string): T {
  const raw = fs.readFileSync(path, 'utf-8');
  return YAML.parse(raw);
}

/**
 * Uploads data to hastebin and returns the URL of the document.
 *
 * @param data The data to upload
 * @param ext The extension of the file (default .js)
 * @returns The url of the document
 */

export async function uploadData(data: any, ext: string = 'js'): Promise<string> {
  const binReq = await fetch('https://hst.sh/documents', {
    method: 'POST',
    body: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
  });

  if (!binReq.ok) throw `Error uploading to hastebin. Status code \`${binReq.status}\`.`;
  const bin = (await binReq.json()) as { key: string };
  return `https://hst.sh/${bin.key}.${ext}`;
}

/**
 * Converts a { Snowflake } to a formatted string with the format <@${Snowflake}}> (\`${Snowflake}\`).
 *
 * @param id The user id to format
 * @returns The formatted string
 */

export function userMentionWithId(id: Snowflake): `<@${Snowflake}> (\`${Snowflake}\`)` {
  return `<@${id}> (\`${id}\`)`;
}

/**
 * Converts a { Snowflake } to a formatted string with the format <#${Snowflake}}> (\`${Snowflake}\`).
 *
 * @param id The channel id to format
 * @returns The formatted string
 */

export function channelMentionWithId(id: Snowflake): `<#${Snowflake}> (\`${Snowflake}\`)` {
  return `<#${id}> (\`${id}\`)`;
}

/**
 * Check if a member has a higher role than another member.
 *
 * @param executor The executor
 * @param target The target
 * @returns boolean (Whether the executor has a higher role than the target)
 */

export function hierarchyCheck(executor: GuildMember, target: GuildMember): boolean {
  if (executor.guild.ownerId === executor.id) return true;
  if (target.guild.ownerId === target.id) return false;
  return executor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

/**
 * Capitalize the first letter of a string.
 *
 * @param str The string to capitalize
 * @returns The capitalized string
 */

export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse a duration string into a number of milliseconds.
 *
 * @param durationStr The duration string to parse
 * @returns The duration in milliseconds
 */

export function parseDuration(durationStr: string | null): number {
  if (durationStr === null) return NaN;

  const numericValue = Number(durationStr);

  if (!isNaN(numericValue)) return numericValue * 1000;
  return ms(durationStr) ?? NaN;
}

/**
 * Crops a string if it exceeds the given length
 *
 * @param str - The string to crop
 * @param maxLength - The maximum length of the string
 * @returns The cropped string (if it exceeds the maximum length)
 */

export function elipsify(str: string, maxLength: number): string {
  if (str.length > maxLength) {
    const croppedStr = str.slice(0, maxLength - 23);
    return `${croppedStr}…(${str.length - croppedStr.length} more characters)`;
  }

  return str;
}

/**
 * Crops a string to a maximum number of lines.
 *
 * - Appends the number of lines cropped if the string exceeds the maximum number of lines.
 *
 * @param str - The string to crop
 * @param maxLines - The maximum number of lines to keep
 * @returns The cropped string
 */

export function cropLines(str: string, maxLines: number): string {
  const lines = str.split('\n');
  const diff = lines.length - maxLines;

  if (diff > 0) {
    const croppedLines = lines.slice(0, maxLines - 1);
    croppedLines.push(`(${diff} more ${pluralize(diff, 'line')})`);

    return croppedLines.join('\n');
  }

  return str;
}

/**
 * Format the content of a message for logging.
 *
 * @param content The content of the message
 * @param stickerId The id of the sticker in the message
 * @param url The URL of the message
 * @param includeUrl Whether to include the message URL in the formatted content
 * @returns The formatted message content
 */

export async function formatMessageContentForShortLog(
  content: string | null,
  sticker_id: string | null,
  url: string | null,
  include_url: boolean = true
): Promise<string> {
  let rawContent = url && include_url ? hyperlink('Jump to message', url) : '';

  if (sticker_id) {
    const sticker = await client.fetchSticker(sticker_id);

    if (sticker.format !== StickerFormatType.Lottie) {
      rawContent += ` \`|\` ${hyperlink(`Sticker: ${sticker.name}`, sticker.url)}`;
    } else {
      // Lottie stickers don't have a direct URL
      rawContent += ` \`|\` Lottie Sticker: ${sticker.name}`;
    }
  }

  if (content) {
    // Escape code blocks
    content = escapeCodeBlock(content);

    if (content.length > 1024) {
      // Upload full content to hastebin if too long
      const hastebinUrl = await uploadData(content, 'txt');
      return rawContent + `${url && include_url ? ` \`|\` ` : ''}${hyperlink('View full content', hastebinUrl)}`;
    }

    // Calculate max content length considering the code block formatting
    const maxContentLength = Math.max(0, 1000 - rawContent.length);
    // Truncate the content if it's too long
    content = elipsify(content, maxContentLength);
  } else {
    content = EMPTY_MESSAGE_CONTENT;
  }

  return rawContent + codeBlock(content);
}

/**
 * Checks if a member has a specific permission.
 * @param member The member to check
 * @param config The guild config
 * @param permission The permission to check for
 */
export function hasPermission(member: GuildMember, config: GuildConfig, permission: PermissionEnum): boolean {
  return member.roles.cache.some(role => {
    return config.permission_nodes.some(node => {
      return node.roles.includes(role.id) && node.allowed.includes(permission);
    });
  });
}

/**
 * Handle replying for interaction
 *
 * @param interaction The interaction to reply to
 * @param options The options to reply with
 */

export function handleInteractionReply(
  interaction: ComponentInteraction | CommandInteraction,
  options: InteractionReplyOptions
): unknown {
  const { ephemeral, ...parsedOptions } = options;

  return !interaction.deferred && !interaction.replied
    ? interaction.reply(options).catch(() => {})
    : interaction.editReply({ ...parsedOptions }).catch(() => {});
}

/**
 * Reply with an error message to an interaction
 *
 * @param data The data for the error
 * @returns unknown
 */

export function handleInteractionErrorReply(
  interaction: ComponentInteraction | CommandInteraction,
  error: string
): unknown {
  return handleInteractionReply(interaction, {
    embeds: [{ description: `${ConfigManager.global_config.emojis.error} ${error}`, color: Colors.NotQuiteBlack }],
    ephemeral: true
  });
}

/**
 * Get the TTL for the interaction reply.
 *
 * @param interaction The interaction to get the TTL for
 * @param config The guild configuration
 * @param options The reply options
 * @returns The TTL for the interaction reply
 */

export function getInteractionTTL(
  interaction: Exclude<Interaction, AutocompleteInteraction> | CommandInteraction,
  config: GuildConfig,
  options: InteractionReplyData
): number {
  if (interaction.isCommand()) {
    return options.temporary ? config.command_temporary_reply_ttl : config.command_error_ttl;
  } else {
    return options.temporary ? config.command_temporary_reply_ttl : config.component_error_ttl;
  }
}

/**
 * Generate a discord Snowflake ID based on the current time.
 * @returns Generated Snowflake
 */

export function generateSnowflakeId(): string {
  return String(SnowflakeUtil.generate({ timestamp: new Date().getTime() }));
}

/**
 * Check if the reply for an interaction should be ephemeral based on the configuration.
 *
 * @param data.interaction The command interaction
 * @param data.config The guild configuration
 * @returns Whether the reply should be ephemeral (boolean)
 */

export function isEphemeralReply(interaction: CommandInteraction<'cached'>, config: GuildConfig): boolean {
  const scope = config.ephemeral_scopes.find(scope => scope.command_name === interaction.commandName);
  const channel = interaction.channel;

  // If no scope or channel, return default setting
  if (!scope || !channel) return config.command_ephemeral_reply;

  const channelData: ChannelScopingParams = {
    channel_id: channel.id,
    thread_id: channel.parentId,
    category_id: null
  };

  // Update channel data if it's a thread
  if (channel.isThread() && channel.parent) {
    channelData.category_id = channel.parent.parentId;
    channelData.thread_id = channel.parentId;
  }

  const channelIds = [channelData.channel_id, channelData.thread_id, channelData.category_id].filter(id => id !== null);

  // If both lists are empty, return default setting
  if (scope.excluded_channels.length === 0 && scope.included_channels.length === 0) {
    return config.command_ephemeral_reply;
  }

  // If excluded channels is not empty, check for exclusion
  if (scope.excluded_channels.length > 0) {
    // If ANY of the channel IDs are in excluded channels, return false (non-ephemeral)
    if (channelIds.some(id => scope.excluded_channels.includes(id))) {
      return false;
    }

    // If no channel IDs are in excluded channels, return true (ephemeral)
    return true;
  }

  // If included channels is not empty, check for inclusion
  if (scope.included_channels.length > 0) {
    // If ANY of the channel IDs are in included channels, return true (ephemeral)
    if (channelIds.some(id => scope.included_channels.includes(id))) {
      return true;
    }
    // If no channel IDs are in included channels, return default setting
    return config.command_ephemeral_reply;
  }

  // If no included or excluded channels are specified, return default
  return config.command_ephemeral_reply;
}

/**
 * Generate the help menu fields for the help command.
 *
 * @param userId The user id to check for developer permissions
 * @returns The help menu fields
 */

export function generateHelpMenuFields(user_id: Snowflake, shortcuts: Shortcut[]): EmbedField[] {
  const categories = Object.values(CommandCategory);
  const commandStore = CommandManager.commands;

  return categories.flatMap(category => {
    const commands = [...commandStore.values()]
      .filter(c => c.category === category)
      .sort((a, b) => a.data.name.localeCompare(b.data.name));

    if (commands.length === 0) return [];

    const fields: EmbedField[] = [
      {
        name: category,
        value: commands.map(c => `\`${c.data.name}\``).join(', '),
        inline: false
      }
    ];

    if (category === CommandCategory.Moderation && shortcuts.length > 0) {
      fields.push({
        name: 'Shortcuts',
        value: shortcuts.map(s => `\`${s.name}\``).join(', '),
        inline: false
      });
    }

    if (category === CommandCategory.Developer && !ConfigManager.global_config.bot.developers.includes(user_id))
      return [];
    return fields;
  });
}

/**
 * Clean the content of a message for logging.
 *
 * @param str The string to clean
 * @param channel The channel this message was sent in
 * @returns The cleaned string
 */

export function cleanContent(str: string, channel: TextBasedChannel): string {
  // Escape custom emojis
  str = str.replace(/<(a?):([^:\n\r]+):(\d{17,19})>/g, '<$1\\:$2\\:$3>');
  // Add IDs to mentions
  str = str.replace(/<@!?(\d{17,19})>/g, `<@$1> ($1)`);
  return djsCleanContent(str, channel);
}

/**
 * Get all possible IDs from a channel.
 *
 * @param channel The channel to extract IDs from
 * @returns The extracted IDs
 */

export function extractChannelIds(channel: GuildTextBasedChannel) {
  const ids: string[] = [channel.id];

  if (channel.isThread()) {
    // Add thread's parent channel ID
    ids.push(channel.parent!.id);

    // If thread's parent channel is in a category, add category ID
    if (channel.parent?.parent) {
      ids.push(channel.parent.parent.id);
    }
  } else if (channel.parent) {
    // Not a thread but in a category
    ids.push(channel.parent.id);
  }

  return ids;
}

/**
 * Build an embed for a message log.
 *
 * @param data.guildId The ID of the guild this message was sent in
 * @param data.messageId The ID of the message
 * @param data.authorId The ID of the author
 * @param data.channelId The ID of the channel
 * @param data.stickerId The ID of the sticker in the message
 * @param data.createdAt The timestamp of the message
 * @param data.content The content of the message
 * @param data.attachments The attachments of the message
 * @param reference Whether this is a reference message
 * @returns The embed for the message log
 */

export async function getMessageLogEmbed(data: MessageLog, reference: boolean): Promise<EmbedBuilder> {
  const url = messageLink(data.channel_id, data.message_id, data.guild_id);

  const embed = new EmbedBuilder()
    .setColor(reference ? Colors.NotQuiteBlack : Colors.Red)
    .setAuthor({ name: reference ? 'Message Reference' : 'Message Deleted' })
    .setFields([
      {
        name: 'Author',
        value: userMentionWithId(data.author_id)
      },
      {
        name: 'Channel',
        value: channelMention(data.channel_id)
      },
      {
        name: reference ? 'Reference Content' : 'Message Content',
        value: await formatMessageContentForShortLog(data.content, data.sticker_id, url)
      }
    ])
    .setTimestamp(data.created_at);

  if (data.attachments?.length) {
    embed.addFields({
      name: reference ? 'Reference Attachments' : 'Message Attachments',
      value: data.attachments.map(attachment => `[Attachment](${attachment})`).join(', ')
    });
  }

  return embed;
}

/**
 * Fetches a reference message from the database or Discord.
 *
 * @param dbMessage The database message entry
 * @param discordMessage The Discord message
 * @returns The reference message, or null if it could not be fetched
 */

export async function getReferenceMessage(
  dbMessage: Message,
  discordMessage: DiscordMessage<true>
): Promise<MessageLog | null> {
  // First try to get from DB, then fallback to Discord API
  const reference =
    (await DatabaseManager.getMessageEntry(dbMessage.reference_id!)) ??
    (await discordMessage.fetchReference().catch(() => null));

  if (!reference) return null;

  // Check if reference is Discord message or DB message
  const isDiscordMessage = reference instanceof DiscordMessage;

  // Build message log object using type-safe property access
  return {
    guild_id: discordMessage.guildId,
    message_id: reference.id,
    author_id: isDiscordMessage ? reference.author.id : reference.author_id,
    channel_id: isDiscordMessage ? reference.channelId : reference.channel_id,
    sticker_id: isDiscordMessage ? reference.stickers?.first()?.id ?? null : reference.sticker_id,
    created_at: isDiscordMessage ? reference.createdAt : new Date(Number(reference.created_at)),
    content: reference.content,
    attachments: isDiscordMessage ? Array.from(reference.attachments.values()).map(a => a.url) : reference.attachments
  };
}

/**
 * Format a message log entry for a bulk message delete event.
 *
 * @param data.createdAt When the message was created
 * @param data.stickerId The ID of the sticker in the message
 * @param data.authorId The ID of the message author
 * @param data.messageContent The content of the message
 * @returns The formatted message log entry
 */

export async function formatMessageBulkDeleteLogEntry(data: {
  createdAt: bigint | number;
  stickerId: Snowflake | null;
  authorId: Snowflake;
  messageContent: string | null;
}) {
  const timestamp = new Date(Number(data.createdAt)).toLocaleString(undefined, LOG_ENTRY_DATE_FORMAT);
  const author = await client.users.fetch(data.authorId).catch(() => ({ username: 'unknown.user' }));

  let content: string | undefined;

  if (data.stickerId) {
    const sticker = await client.fetchSticker(data.stickerId).catch(() => null);

    if (sticker && sticker.format === StickerFormatType.Lottie) {
      content = `Lottie Sticker "${sticker.name}": ${data.stickerId}`;
    } else if (sticker) {
      content = `Sticker "${sticker.name}": ${sticker.url}`;
    }

    if (data.messageContent && content) {
      content = ` | Message Content: ${data.messageContent}`;
    }
  }

  content ??= data.messageContent ?? EMPTY_MESSAGE_CONTENT;
  return `[${timestamp}] @${author.username} (${data.authorId}) - ${content}`;
}

/**
 * Calculate the size of a command.
 *
 * @param command The command to calculate the size of
 * @returns The total size of the command and a breakdown of the size
 */

export function calculateCommandSize(command: ChatInputApplicationCommandData): {
  total: number;
  breakdown: { [key: string]: number };
} {
  const breakdown: { [key: string]: number } = {};
  let total = 0;

  // Name and description
  breakdown.name = command.name.length;
  breakdown.description = command.description.length;
  total += breakdown.name + breakdown.description;

  // Calculate options size recursively
  if (command.options) {
    breakdown.options = 0;

    const calculateOptionSize = (option: any): number => {
      let size = 0;

      // Add name and description lengths
      size += option.name?.length || 0;
      size += option.description?.length || 0;

      // Add choices if present
      if (option.choices) {
        for (const choice of option.choices) {
          size += choice.name.length;
          size += String(choice.value).length;
        }
      }

      // Recursively calculate subcommand/group options
      if (
        option.options &&
        [ApplicationCommandOptionType.Subcommand, ApplicationCommandOptionType.SubcommandGroup].includes(option.type)
      ) {
        for (const subOption of option.options) {
          size += calculateOptionSize(subOption);
        }
      }

      return size;
    };

    for (const option of command.options) {
      breakdown.options += calculateOptionSize(option);
    }

    total += breakdown.options;
  }

  return { total, breakdown };
}

/**
 * Send a notification to the configured notification webhook.
 *
 * @param data.config The guild configuration
 * @param data.options The options for the message
 * @returns The message sent to the webhook, or null if the webhook is not configured
 */

export async function sendNotification(data: {
  config: GuildConfig;
  options: MessageCreateOptions;
}): Promise<APIMessage | null> {
  const { config, options } = data;

  if (!config.notification_webhook) {
    return null;
  }

  return new WebhookClient({ url: config.notification_webhook }).send(options).catch(() => null);
}

// Things that are used in this file only

interface ChannelScopingParams {
  channel_id: Snowflake;
  thread_id: Snowflake | null;
  category_id: Snowflake | null;
}
