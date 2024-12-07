import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock
} from 'discord.js';

import util from 'util';
import ms from 'ms';

import { uploadData } from '@utils/index';
import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

// @ts-ignore
let _;

export default class Evaluate extends Command {
  constructor() {
    super({
      guarded: true,
      category: CommandCategory.Developer,
      usage: '<code> [async] [depth] [dm] [ephemeral]',
      data: {
        name: 'evaluate',
        description: 'Evaluate JavaScript code.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'code',
            description: 'The code to evaluate.',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'async',
            description: 'Whether the evaluation should be asynchronous.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          },
          {
            name: 'depth',
            description: 'The depth of the inspected output.',
            type: ApplicationCommandOptionType.Integer,
            required: false
          },
          {
            name: 'dm',
            description: 'Whether the output should be sent in DMs.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          },
          {
            name: 'ephemeral',
            description: 'Whether the output should be ephemeral.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<InteractionReplyData> {
    const context = Evaluate.getExecutionContext(interaction);

    await interaction.deferReply({ ephemeral: context.ephemeral });

    let rawOutput;
    let error = false;
    const start = performance.now();

    try {
      rawOutput = await eval(context.async ? `(async() => { ${context.code} })()` : context.code);
    } catch (e) {
      rawOutput = e;
      error = true;
    }

    const timeTaken = performance.now() - start;
    const type = typeof rawOutput;
    const output = typeof rawOutput === 'string' ? rawOutput : util.inspect(rawOutput, { depth: context.depth });

    return Evaluate.processResult(interaction, { type, timeTaken, output, error }, context);
  }

  private static getExecutionContext(interaction: ChatInputCommandInteraction) {
    return {
      code: interaction.options.getString('code', true),
      async: interaction.options.getBoolean('async') ?? false,
      depth: interaction.options.getInteger('depth') ?? 0,
      dm: interaction.options.getBoolean('dm') ?? false,
      ephemeral: interaction.options.getBoolean('ephemeral') ?? false
    };
  }

  private static async processResult(
    interaction: ChatInputCommandInteraction,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<InteractionReplyData> {
    if (result.output.length > 1900) {
      return Evaluate.handleLargeOutput(interaction, result, context);
    }

    const content = result.error
      ? `**Error**\n${codeBlock('ts', result.output)}`
      : `**Output**\n${codeBlock('ts', result.output)}\n**Return Type:** \`${
          result.type
        }\`\n**Time Taken:** \`${Evaluate.formatTime(result.timeTaken)}\``;

    return context.dm ? Evaluate.sendDirectMessage(interaction, content) : { content };
  }

  private static formatTime(timeTaken: number): string {
    return timeTaken < 1 ? `${Math.round(timeTaken / 1e-2)} microseconds` : ms(Math.round(timeTaken), { long: true });
  }

  private static async handleLargeOutput(
    interaction: ChatInputCommandInteraction,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<InteractionReplyData> {
    const dataUrl = await uploadData(result.output, 'ts');
    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Output').setURL(dataUrl);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    if (context.dm) {
      try {
        await interaction.user.send({
          content: `**Return Type:** \`${result.type}\`\n**Time Taken:** \`${this.formatTime(result.timeTaken)}\``,
          components: [actionRow]
        });
        return { content: 'Successfully sent the output to your DMs.' };
      } catch {
        return { content: 'The output could not be sent to your DMs. Please make sure they are enabled.' };
      }
    }

    return {
      content: `**Return Type:** \`${result.type}\`\n**Time Taken:** \`${this.formatTime(result.timeTaken)}\``,
      components: [actionRow]
    };
  }

  private static async sendDirectMessage(
    interaction: ChatInputCommandInteraction,
    content: string
  ): Promise<InteractionReplyData> {
    try {
      await interaction.user.send({ content });
      return { content: 'Successfully sent the output to your DMs.' };
    } catch {
      return { content: 'The output could not be sent to your DMs. Please make sure they are enabled.' };
    }
  }
}

interface ExecutionContext {
  code: string;
  async: boolean;
  depth: number;
  dm: boolean;
  ephemeral: boolean;
}

interface ExecutionResult {
  output: string;
  type: string;
  timeTaken: number;
  error: boolean;
}
