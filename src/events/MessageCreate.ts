import { Colors, Events, Message } from 'discord.js';
import { reply, send } from '@skyra/editable-commands';

import { client, Sentry } from '@/index';

import ConfigManager from '@managers/config/ConfigManager';
import CommandManager from '@managers/commands/CommandManager';
import EventListener from '@/managers/events/EventListener';
import Logger from '@utils/logger';
import GuildCache from '@managers/database/GuildCache';

export default class MessageCreate extends EventListener {
  constructor() {
    super(Events.MessageCreate);
  }

  async execute(message: Message) {
    await MessageCreate.handleMessageCommand(message);
  }

  static async handleMessageCommand(message: Message) {
    if (message.author.bot || message.webhookId !== null) return;

    const prefix = await MessageCreate._determinePrefix(message);
    if (!prefix) return;

    const commandPrefix = MessageCreate._getCommandPrefix(message.content, prefix);
    const prefixLess = message.content.slice(commandPrefix.length).trim();
    const spaceIndex = prefixLess.indexOf(' ');

    const commandName = spaceIndex === -1 ? prefixLess : prefixLess.slice(0, spaceIndex);
    if (commandName.length === 0) return;

    const command = CommandManager.getMessageCommand(commandName.toLowerCase());
    if (!command) return;

    if (!command.allowInDms && !message.inGuild()) {
      return MessageCreate._handleStringError(message, 'This command cannot be used in DMs.');
    }

    const parameters = spaceIndex === -1 ? '' : prefixLess.substring(spaceIndex + 1).trim();
    const args = await command.parse(message, parameters, { prefix, commandName, commandPrefix });

    try {
      await command.execute(message, args);
    } catch (error) {
      return MessageCreate._handleCommandError(message, command.name, error);
    }
  }

  private static async _determinePrefix(message: Message): Promise<string | RegExp | null> {
    const mentionPrefix = MessageCreate._getMentionPrefix(message);
    const { regexPrefix } = client;

    if (mentionPrefix) {
      if (message.content.length === mentionPrefix.length) {
        client.emit(Events.MentionPrefix, message);
        return null;
      }
      return mentionPrefix;
    }

    if (regexPrefix.test(message.content)) {
      return regexPrefix;
    }

    if (message.inGuild()) {
      return (await GuildCache.get(message.guildId)).msgCmdsPrefix;
    }

    return ConfigManager.global_config.commands.prefix;
  }

  private static _getMentionPrefix(message: Message): string | null {
    // If the content is shorter than 20 characters, or does not start with `<@` then skip early:
    if (message.content.length < 20 || !message.content.startsWith('<@')) return null;

    // Calculate the offset and the ID that is being provided
    const [offset, id] =
      message.content[2] === '&'
        ? [3, message.guild?.roles.botRoleFor(client.user!.id)?.id]
        : [message.content[2] === '!' ? 3 : 2, client.user!.id];

    if (!id) return null;

    const offsetWithId = offset + id.length;

    // If the mention doesn't end with `>`, skip early:
    if (message.content[offsetWithId] !== '>') return null;

    // Check whether or not the ID is the same as the managed role ID:
    const mentionId = message.content.substring(offset, offsetWithId);
    if (mentionId === id) return message.content.substring(0, offsetWithId + 1);

    return null;
  }

  private static _getCommandPrefix(content: string, prefix: string | RegExp): string {
    return typeof prefix === 'string' ? prefix : prefix.exec(content)![0];
  }

  private static _handleCommandError(message: Message, commandName: string, error: any) {
    if (typeof error !== 'string') {
      return MessageCreate._handleNonStringError(message, commandName, error);
    }
    return MessageCreate._handleStringError(message, error);
  }

  private static _handleNonStringError(message: Message, commandName: string, error: any) {
    const sentryId = Sentry.captureException(error, {
      user: {
        id: message.author.id,
        name: message.author.displayName,
        username: message.author.username
      },
      extra: {
        guild: message.guild?.id,
        channel: message.channel?.id,
        command: commandName
      }
    });

    Logger.error(`Error executing message command "${commandName}" (${sentryId})`, error);
    return MessageCreate._handleStringError(
      message,
      `An error occurred while executing this command... (ID \`${sentryId}\`)`,
      true
    );
  }

  private static async _handleStringError(
    message: Message,
    error: string,
    preserve: boolean = false,
    delay: number = 7500
  ) {
    const repl = await reply(message, { embeds: [{ description: error, color: Colors.Red }] }).catch(async () => {
      return await send(message, { embeds: [{ description: error, color: Colors.Red }] });
    });

    if (preserve) return;

    setTimeout(async () => {
      await repl?.delete().catch(() => {});
      await message.delete().catch(() => {});
    }, delay);
  }
}
