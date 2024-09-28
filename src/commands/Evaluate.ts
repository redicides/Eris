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

import { uploadData } from '@/utils';
import { InteractionReplyData } from '@/utils/types';

import ApplicationCommand, { CommandCategory } from '@managers/commands/ApplicationCommand';

let _;

export default class Evaluate extends ApplicationCommand<ChatInputCommandInteraction> {
  constructor() {
    super({
      guarded: true,
      allowInDms: true,
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
    const code = interaction.options.getString('code', true);
    const async = interaction.options.getBoolean('async') ?? false;
    const depth = interaction.options.getInteger('depth') ?? 0;
    const dm = interaction.options.getBoolean('dm') ?? false;
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

    let output;
    let error: boolean = false;

    let start: number;
    let timeTaken: number;

    await interaction.deferReply({ ephemeral });

    try {
      start = performance.now();
      output = await eval(async ? `(async() => { ${code} })()` : code);
      timeTaken = performance.now() - start;
    } catch (e) {
      timeTaken = performance.now() - start!;
      error = true;
      output = e;
    }

    _ = output;
    const type = typeof output;
    output = typeof output === 'string' ? output : util.inspect(output, { depth });

    const unit =
      timeTaken < 1 ? `${Math.round(timeTaken / 1e-2)} microseconds` : ms(Math.round(timeTaken), { long: true });

    if (output.length > 1900) {
      const dataUrl = await uploadData(output, 'ts');

      const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Output').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      if (dm) {
        let failed = false;

        await interaction.user
          .send({
            content: `**Return Type:** \`${type}\`\n**Time Taken:** \`${unit}\``,
            components: [actionRow]
          })
          .catch(() => {
            failed = true;
          });

        return {
          content: failed
            ? 'The output could not be sent to your DMs. Please make sure they are enabled.'
            : 'Successfully sent the output to your DMs.'
        };
      }

      return { content: `**Return Type:** \`${type}\`\n**Time Taken:** \`${unit}\``, components: [actionRow] };
    }

    const content = error
      ? `**Error**\n${codeBlock('ts', output)}`
      : `**Output**\n${codeBlock('ts', output)}\n**Return Type:** \`${type}\`\n**Time Taken:** \`${unit}\``;

    if (dm) {
      let failed = false;

      await interaction.user.send({ content }).catch(() => {
        failed = true;
      });

      return {
        content: failed
          ? 'The output could not be sent to your DMs. Please make sure they are enabled.'
          : 'Successfully sent the output to your DMs.'
      };
    }

    return { content };
  }
}
