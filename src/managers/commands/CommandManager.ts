import { ChatInputCommandInteraction, Collection, GuildMember, Snowflake, User } from 'discord.js';
import { ModerationCommand } from '@prisma/client';

import path from 'path';
import fs from 'fs';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { MessageKeys } from '@utils/Keys';
import { pluralize } from '@utils/index';
import { client } from '@/index';

import Command from './Command';
import InfractionManager from '../database/InfractionManager';
import TaskManager from '../database/TaskManager';
import Logger, { AnsiColor } from '@utils/Logger';
import { SHORTCUT_PERMISSIONS } from '@/utils/Constants';

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
    command: ModerationCommand,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    if (!command.enabled) {
      return {
        error: MessageKeys.Errors.CommandDisabled,
        temporary: true
      };
    }

    const { action, reason, duration, messageDeleteTime } = command;

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

    const target = interaction.options.getUser('target') ?? interaction.options.getMember('target');

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

    const createdAt = Date.now();
    const expiresAt = duration ? createdAt + Number(duration) : null;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: action,
      reason,
      createdAt,
      expiresAt
    });

    if (expiresAt && (action === 'Mute' || action === 'Ban')) {
      await TaskManager.storeTask({
        guildId: interaction.guildId,
        targetId: target.id,
        infractionId: infraction.id,
        type: action,
        expiresAt
      });
    } else {
      if (action === 'Ban') {
        await TaskManager.deleteTask({
          targetId_guildId_type: { targetId: target.id, guildId: interaction.guildId, type: 'Ban' }
        });
      }

      if (action === 'Unmute') {
        await TaskManager.deleteTask({
          targetId_guildId_type: { targetId: target.id, guildId: interaction.guildId, type: 'Mute' }
        });
      }
    }

    if (target instanceof GuildMember) {
      await InfractionManager.sendNotificationDM({
        config,
        guild: interaction.guild,
        target,
        infraction,
        additional: command.additionalInfo ?? undefined
      });
    }

    let punishmentFailed = false;

    if (action !== 'Warn') {
      await InfractionManager.resolvePunishment({
        guild: interaction.guild,
        executor: interaction.member!,
        target,
        action,
        reason,
        duration: duration ? Number(duration) : null,
        deleteMessages: messageDeleteTime ?? undefined
      }).catch(() => (punishmentFailed = true));

      if (punishmentFailed) {
        await InfractionManager.deleteInfraction({ id: infraction.id });
        return {
          error: MessageKeys.Errors.PunishmentFailed(action, target),
          temporary: true
        };
      }
    }

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
