import {
  ApplicationCommandData,
  Awaitable,
  Colors,
  CommandInteraction,
  InteractionReplyOptions,
  PermissionFlagsBits,
  PermissionsBitField
} from 'discord.js';

import { client, prisma } from '@/index';

// The base class for all commands.
export default abstract class ApplicationCommand<T extends CommandInteraction> {
  /**
   * The client that owns this command.
   */

  public client = client;

  /**
   * Attached prisma client for ease of use
   */

  public prisma = prisma;

  /**
   * The category of the command.
   */

  public readonly category: CommandCategory | null;

  /**
   * Whether the command is guarded (meaning it can only be ran by the developers).
   */

  public readonly isGuarded: boolean;

  /**
   * The (application command) data for the command.
   */

  public readonly data: ApplicationCommandData;

  /**
   * Whether the command can be ran outside of guilds.
   */

  public readonly allowInDms: boolean;

  /**
   * The permissions required by the client to run the command.
   */

  public readonly requiredPermissions: PermissionsBitField | null;

  /**
   * Usage example for the command.
   */

  public readonly usage: string | string[] | null;

  /**
   * @param options The options for the command.
   * @param options.category The category of the command.
   * @param options.data The (application command) data for the command.
   * @param options.allowInDms Whether the command can be ran outside of guilds.
   * @param options.requiredPermissions The permissions required by the client to run the command.
   * @protected
   */
  protected constructor(options: CommandOptions) {
    this.category = options.category ?? null;
    this.data = {
      ...options.data,
      defaultMemberPermissions: (options.data.defaultMemberPermissions ??= PermissionFlagsBits.SendMessages),
      dmPermission: (options.allowInDms ??= false)
    };
    this.requiredPermissions = options.requiredPermissions
      ? new PermissionsBitField(options.requiredPermissions).freeze()
      : null;
    this.allowInDms = options.allowInDms ?? false;
    this.usage = options.usage ?? null;
    this.isGuarded = options.guarded ?? false;
  }

  /**
   * Throws an error to the user.
   *
   * @param interaction  The interaction to reply to.
   * @param options The options for the error.
   * @returns The error message.
   */

  protected async error(interaction: T, options: string | InteractionReplyOptions) {
    return !interaction.deferred && !interaction.replied
      ? this.initialReply(interaction, options)
      : this.editReply(interaction, options);
  }

  private initialReply(interaction: T, options: string | InteractionReplyOptions) {
    const replyOptions =
      typeof options === 'string'
        ? { embeds: [{ description: options, color: Colors.Red }], ephemeral: true }
        : options;

    return interaction.reply(replyOptions);
  }

  private editReply(interaction: T, options: string | InteractionReplyOptions) {
    const replyOptions =
      typeof options === 'string' ? { embeds: [{ description: options, color: Colors.Red }] } : options;

    const { ephemeral, ...editReplyOptions } = replyOptions;
    return interaction.editReply(editReplyOptions);
  }

  /**
   * Handles the command interaction. Mentions are disabled by default.
   * @param interaction The interaction to handle.
   */
  abstract execute(interaction: T): Awaitable<unknown>;
}

interface CommandOptions {
  guarded?: boolean;
  category?: CommandCategory;
  allowInDms?: boolean;
  requiredPermissions?: bigint | bigint[];
  usage?: string | string[];
  data: ApplicationCommandData;
}

export enum CommandCategory {
  Developer = 'Developer',
  Utility = 'Utility'
}