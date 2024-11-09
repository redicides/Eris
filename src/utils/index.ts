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
  ApplicationCommandOptionType
} from 'discord.js';
import { PermissionEnum, Message } from '@prisma/client';

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
 * @returns The formatted message content
 */

export async function formatMessageContentForShortLog(
  content: string | null,
  stickerId: string | null,
  url: string | null,
  includeUrl: boolean = true
): Promise<string> {
  let rawContent = url && includeUrl ? hyperlink('Jump to message', url) : '';

  if (stickerId) {
    const sticker = await client.fetchSticker(stickerId);

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
    // Truncate the content if it's too long (account for the formatting characters)
    content = elipsify(content, 1024 - rawContent.length - 6);
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
    return config.permissions.some(perm => {
      return perm.roles.includes(role.id) && perm.allow.includes(permission);
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

export function handleInteractionErrorReply(data: {
  interaction: ComponentInteraction | CommandInteraction;
  error: string;
}): unknown {
  const { interaction, error } = data;

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
    return options.temporary ? config.commandTemporaryReplyTTL : config.commandErrorTTL;
  } else {
    return options.temporary ? config.componentTemporaryReplyTTL : config.componentErrorTTL;
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

export function isEphemeral(data: { interaction: CommandInteraction<'cached'>; config: GuildConfig }): boolean {
  const { interaction, config } = data;
  const scope = config.ephemeralScopes.find(scope => scope.commandName === interaction.commandName);

  if (!scope || !interaction.channel) return config.commandEphemeralReply;

  const channelIds = extractChannelIds(interaction.channel);

  return channelIds.some(id => scope.excludedChannels.includes(id))
    ? true
    : channelIds.some(id => scope.includedChannels.includes(id));
}

/**
 * Generate the help menu fields for the help command.
 *
 * @param userId The user id to check for developer permissions
 * @returns The help menu fields
 */

export function generateHelpMenuFields(userId: Snowflake): EmbedField[] {
  const categories = Object.values(CommandCategory);
  const commandStore = CommandManager.application_commands;

  return categories.flatMap(category => {
    const commands = [...commandStore.values()]
      .filter(c => c.category === category)
      .sort((a, b) => a.data.name.localeCompare(b.data.name));

    if (commands.length === 0) return [];

    const field: EmbedField = {
      name: category,
      value: commands.map(c => `\`${c.data.name}\``).join(', '),
      inline: false
    };

    if (category === CommandCategory.Developer && !ConfigManager.global_config.developers.includes(userId)) return [];
    const fields = [field];

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
  const url = messageLink(data.channelId, data.messageId, data.guildId);

  const embed = new EmbedBuilder()
    .setColor(reference ? Colors.NotQuiteBlack : Colors.Red)
    .setAuthor({ name: reference ? 'Message Reference' : 'Message Deleted' })
    .setFields([
      {
        name: 'Author',
        value: userMentionWithId(data.authorId)
      },
      {
        name: 'Channel',
        value: channelMention(data.channelId)
      },
      {
        name: reference ? 'Reference Content' : 'Message Content',
        value: await formatMessageContentForShortLog(data.content, data.stickerId, url)
      }
    ])
    .setTimestamp(data.createdAt);

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
  const referenceMessage: Message | DiscordMessage | null =
    (await DatabaseManager.getMessageEntry(dbMessage.referenceId!)) ??
    (await discordMessage.fetchReference().catch(() => null));

  if (!referenceMessage) return null;

  return {
    guildId: discordMessage.guildId,
    messageId: referenceMessage.id,
    authorId:
      (referenceMessage instanceof DiscordMessage ? referenceMessage.author.id : referenceMessage.authorId) ?? null,
    channelId: referenceMessage.channelId,
    stickerId:
      'stickerId' in referenceMessage ? referenceMessage.stickerId : (referenceMessage.stickers?.first()?.id ?? null),
    createdAt:
      referenceMessage instanceof DiscordMessage
        ? referenceMessage.createdAt
        : new Date(Number(referenceMessage.createdAt)),
    content: referenceMessage.content,
    attachments:
      referenceMessage instanceof DiscordMessage
        ? Array.from(referenceMessage.attachments.values()).map(attachment => attachment.url)
        : referenceMessage.attachments
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
