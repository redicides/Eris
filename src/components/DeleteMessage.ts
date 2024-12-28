import { ButtonInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Component from '@eris/Component';

export default class DeleteMessageComponent extends Component {
  constructor() {
    super({ matches: /^delete-message-\d{17,19}-\d{17,19}$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData> {
    const channelId = interaction.customId.split('-')[2];
    const messageId = interaction.customId.split('-')[3];

    const channel = (await interaction.guild.channels.fetch(channelId).catch(() => null)) as TextChannel;

    if (!channel) {
      return {
        error: `Failed to fetch the channel for message with ID \`${messageId}\`.`,
        temporary: true
      };
    }

    if (!channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageMessages)) {
      return {
        error: `I do not have permission to delete messages in ${channel}.`,
        temporary: true
      };
    }

    if (!channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageMessages)) {
      return {
        error: `You do not have permission to delete messages in ${channel}.`,
        temporary: true
      };
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);

    if (!message) {
      return {
        error: `That message has already been deleted or cannot be fetched (\`${messageId}\`).`,
        temporary: true
      };
    }

    let failed = false;

    await message.delete().catch(() => {
      failed = true;
    });

    return failed
      ? { error: `Failed to delete message ${message.url} (\`${message.id}\`).`, temporary: true }
      : { content: `Successfully deleted the message (\`${message.id}\`).`, temporary: true };
  }
}
