import { ChatInputCommandInteraction, Collection, GuildMember, Snowflake, User } from 'discord.js';
import { InfractionAction, Shortcut } from '@prisma/client';

import path from 'path';
import fs from 'fs';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ShortcutPermissionFlags } from '@utils/Constants';
import { MessageKeys } from '@utils/Keys';
import { pluralize } from '@utils/index';
import { client, prisma } from '@/index';

import Command from '@eris/Command';
import InfractionManager from '../database/InfractionManager';
import TaskManager from '../database/TaskManager';
import Logger, { AnsiColor } from '@utils/Logger';
import ConfigManager from '../config/ConfigManager';

export default class CommandManager {
  /**
   * The cached application commands.
   */
  public static readonly commands = new Collection<string, Command>();

  /**
   * Caches all commands from the commands directory.
   * @returns void
   */
  static async cacheCommands() {
    const dirpath = path.resolve('src/commands');

    if (!fs.existsSync(dirpath)) {
      Logger.info(`Skipping application command caching: commands directory not found.`);
      return;
    }

    let commandCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const commandModule = require(`../../../commands/${file.slice(0, -3)}`);
        const commandClass = commandModule.default;
        const command = new commandClass();

        if (!(command instanceof Command)) {
          Logger.warn(`Skipping command caching: ${file} is not an instance of Command.`);
          continue;
        }

        let logMessage: string;
        let level: string;

        CommandManager.commands.set(command.data.name, command);

        logMessage = `Cached command "${command.data.name}"`;
        level = 'GLOBAL';

        Logger.log(level, logMessage, {
          color: AnsiColor.Purple
        });

        commandCount++;
      }
    } catch (error) {
      Logger.error(`Error when caching commands:`, error);
    } finally {
      Logger.info(`Cached ${commandCount} ${pluralize(commandCount, 'application command')}.`);
    }
  }

  static async publish() {
    Logger.info('Publishing commands...');

    const logMessage = (commandCount: number): string =>
      `Published ${commandCount} ${pluralize(commandCount, 'command')}.`;

    const globalCommands = CommandManager.commands
      .filter(command => !command.isDevGuildOnly)
      .map(command => command.data);

    const guildCommands = CommandManager.commands
      .filter(command => command.isDevGuildOnly)
      .map(command => command.data);

    if (globalCommands.length) {
      const publishedCommands = await client.application?.commands.set(globalCommands).catch(error => {
        Logger.error('Failed to publish global commands:', error);
        return null;
      });

      if (!publishedCommands) {
        Logger.warn('No global commands were published. Aborting...');
        process.exit(1);
      }

      Logger.log('GLOBAL', logMessage(publishedCommands.size), {
        color: AnsiColor.Purple
      });
    } else {
      Logger.warn('No global commands to publish.');
    }

    if (guildCommands.length) {
      const guildIds = ConfigManager.global_config.bot.developer_guilds;

      for (const guildId of guildIds) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);

        if (!guild) {
          Logger.warn(`Failed to fetch developer guild ${guildId}. Skipping guild command registration...`);
          continue;
        }

        const publishedCommands = await guild.commands.set(guildCommands).catch(error => {
          Logger.error(`Failed to publish guild commands for ${guild.name}:`, error);
          return null;
        });

        if (!publishedCommands) {
          Logger.warn(`No guild commands were published for ${guild.name}. Skipping...`);
          continue;
        }

        Logger.log(`GUILD:${guildId}`, logMessage(publishedCommands.size), {
          color: AnsiColor.Purple
        });
      }
    }
  }

  /**
   * Retrieves a command by its name. Checks both lowercased and capitalized names.
   *
   * @param commandName The name of the command to search for
   */

  static getCommand(commandName: string): Command | null {
    return CommandManager.commands.get(commandName || commandName.toLowerCase()) ?? null;
  }

  /**
   * Retrieves a shortcut by its name.
   *
   * @param shortcutName The name of the shortcut to search for
   * @param guild_id The guild ID to search in
   * @returns The shortcut, if found
   */

  static async getShortcutByName(shortcutName: string, guild_id: Snowflake): Promise<Shortcut | null> {
    return prisma.shortcut.findUnique({
      where: { name: shortcutName.toLowerCase(), guild_id }
    });
  }

  /**
   * Handler for custom moderation commands
   *
   * @param interaction The interaction that triggered the command
   * @param config The guild's configuration
   * @param command The command data
   * @param ephemeral Whether the reply should be ephemeral
   * @returns The reply data
   */

  static async handleCustomModerationCommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    command: Shortcut,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    if (!command.enabled) {
      return {
        error: MessageKeys.Errors.CommandDisabled,
        temporary: true
      };
    }

    const { action, reason, duration, message_delete_time } = command;

    if (action !== 'Warn') {
      const permissions = ShortcutPermissionFlags[action];

      if (
        !interaction.appPermissions.has(permissions) ||
        !interaction.channel?.permissionsFor(interaction.guild.members.me!).has(permissions)
      ) {
        return {
          error: MessageKeys.Errors.MissingPermissions(permissions),
          temporary: true
        };
      }
    }

    const target =
      interaction.options.getMember('member') ??
      interaction.options.getUser('member') ??
      interaction.options.getUser('user');

    if (!target) {
      return {
        error:
          action === 'Ban' || action === 'Unban'
            ? MessageKeys.Errors.MemberNotFound
            : MessageKeys.Errors.TargetNotFound,
        temporary: true
      };
    }

    if (action !== 'Ban' && action !== 'Unban' && target instanceof User) {
      return {
        error: MessageKeys.Errors.MemberNotFound,
        temporary: true
      };
    }

    const vResult = InfractionManager.validateAction({
      config,
      guild: interaction.guild,
      executor: interaction.member!,
      target,
      action,
      reason
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    await interaction.deferReply({ ephemeral });

    const currentDate = Date.now();
    const expiresAt = duration ? new Date(currentDate + Number(duration)) : null;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: interaction.guildId,
      target_id: target.id,
      executor_id: interaction.user.id,
      action,
      reason,
      expires_at: expiresAt
    });

    if (target instanceof GuildMember) {
      await InfractionManager.sendNotificationDM({
        config,
        guild: interaction.guild,
        target,
        infraction,
        customInfo: command.additional_info ?? undefined
      });
    }

    if (action !== 'Warn') {
      const punishment = await InfractionManager.resolvePunishment({
        guild: interaction.guild,
        target,
        executor: interaction.member,
        action,
        reason,
        duration: duration ? Number(duration) : null,
        deleteMessageSeconds: message_delete_time ?? undefined
      });

      if (!punishment.success) {
        await InfractionManager.deleteInfraction({ id: infraction.id });

        return {
          error: MessageKeys.Errors.PunishmentFailed(action, target),
          temporary: true
        };
      }
    }

    Promise.all([
      InfractionManager.logInfraction(config, infraction),
      CommandManager._runInfractionTasks({
        guildId: interaction.guildId,
        targetId: target.id,
        infractionId: infraction.id,
        action,
        expiresAt
      })
    ]);

    return {
      embeds: [
        {
          description: InfractionManager.getSuccessMessage(infraction, target),
          color: InfractionManager.mapActionToColor(action)
        }
      ]
    };
  }

  private static async _runInfractionTasks(data: {
    guildId: Snowflake;
    targetId: Snowflake;
    infractionId: Snowflake;
    action: InfractionAction;
    expiresAt: Date | null;
  }) {
    const { guildId, targetId, infractionId, action, expiresAt } = data;

    if (action === 'Warn' || action === 'Kick') return null;

    const deleteType = action === 'Unmute' ? 'Mute' : 'Ban';

    return expiresAt
      ? TaskManager.storeTask({
          guild_id: guildId,
          target_id: targetId,
          infraction_id: infractionId,
          action: action as 'Mute' | 'Ban',
          expires_at: expiresAt
        })
      : TaskManager.deleteTask({
          target_id_guild_id_action: { target_id: targetId, guild_id: guildId, action: deleteType }
        });
  }
}
