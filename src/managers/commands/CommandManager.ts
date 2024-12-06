import { ChatInputCommandInteraction, Collection, GuildMember, Snowflake, User } from 'discord.js';
import { Shortcut } from '@prisma/client';

import path from 'path';
import fs from 'fs';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { SHORTCUT_PERMISSIONS } from '@utils/Constants';
import { MessageKeys } from '@utils/Keys';
import { pluralize } from '@utils/index';
import { client } from '@/index';

import Command from './Command';
import InfractionManager from '../database/InfractionManager';
import TaskManager from '../database/TaskManager';
import Logger, { AnsiColor } from '@utils/Logger';

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
        const commandModule = require(`../../commands/${file.slice(0, -3)}`);
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

    const globalCommands = CommandManager.commands.map(command => command.data);

    if (!globalCommands.length) {
      Logger.warn('No global commands to publish.');
      return;
    }

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
  }

  static getCommand(commandId: Snowflake, commandName: string): Command | null {
    const isGlobalCommand = client.application?.commands.cache.has(commandId);

    if (isGlobalCommand) {
      return CommandManager.commands.get(commandName) ?? null;
    }

    return null;
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
      const requiredPermissions = SHORTCUT_PERMISSIONS[action];
      if (
        !interaction.appPermissions.has(requiredPermissions) ||
        !interaction.channel?.permissionsFor(interaction.guild.members.me!).has(requiredPermissions)
      ) {
        return {
          error: MessageKeys.Errors.MissingPermissions(requiredPermissions.bitfield),
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

    const created_at = Date.now();
    const expires_at = duration ? created_at + Number(duration) : null;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: interaction.guildId,
      target_id: target.id,
      executor_id: interaction.user.id,
      type: action,
      reason,
      created_at,
      expires_at
    });

    if (expires_at && (action === 'Mute' || action === 'Ban')) {
      await TaskManager.storeTask({
        guild_id: interaction.guildId,
        target_id: target.id,
        infraction_id: infraction.id,
        type: action,
        expires_at
      });
    } else {
      // Delete ban task if the action is a permanent ban or an unban

      if (action === 'Ban' || action === 'Unban') {
        await TaskManager.deleteTask({
          target_id_guild_id_type: { target_id: target.id, guild_id: interaction.guildId, type: 'Ban' }
        });
      }

      // Delete mute task if the action is an unmute

      if (action === 'Unmute') {
        await TaskManager.deleteTask({
          target_id_guild_id_type: { target_id: target.id, guild_id: interaction.guildId, type: 'Mute' }
        });
      }
    }

    if (target instanceof GuildMember) {
      await InfractionManager.sendNotificationDM({
        config,
        guild: interaction.guild,
        target,
        infraction,
        info: command.additional_info ?? undefined
      });
    }

    if (action !== 'Warn') {
      let punishmentFailed = false;

      await InfractionManager.resolvePunishment({
        guild: interaction.guild,
        executor: interaction.member!,
        target,
        action,
        reason,
        duration: duration ? Number(duration) : null,
        deleteMessages: message_delete_time ?? undefined
      }).catch(() => (punishmentFailed = true));

      if (punishmentFailed) {
        await InfractionManager.deleteInfraction({ id: infraction.id });

        return {
          error: MessageKeys.Errors.PunishmentFailed(action, target),
          temporary: true
        };
      }
    }

    await InfractionManager.logInfraction({ config, infraction });

    return {
      embeds: [
        {
          description: InfractionManager.getSuccessMessage({ target, infraction }),
          color: InfractionManager.mapActionToColor({ infraction })
        }
      ]
    };
  }
}
