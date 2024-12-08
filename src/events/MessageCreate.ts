import { Events, Message } from 'discord.js';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import { prisma } from '..';
import { extractChannelIds } from '@/utils';
import { AutomodType } from '@prisma/client';
import Logger from '@/utils/Logger';

export default class MessageCreate extends EventListener {
  constructor() {
    super(Events.MessageCreate);
  }

  async execute(message: Message) {
    if (!message.inGuild()) return;
    if (message.author.bot || message.webhookId !== null || message.system) return;

    DatabaseManager.queueMessageEntry(message);
    MessageCreate.runAutoMod(message);
  }

  public static async runAutoMod(message: Message<true>) {
    if (message.member === null) return;

    const rules = await prisma.automod.findMany({ where: { guild_id: message.guild.id } });
    const channelIds = extractChannelIds(message.channel);

    if (!rules.length) return;

    const groupRules = rules.reduce((acc, rule) => {
      acc[rule.type] = acc[rule.type] || [];
      acc[rule.type].push(rule);
      return acc;
    }, {} as Record<AutomodType, typeof rules>);

    const isImmune = (rule: (typeof rules)[0]) =>
      channelIds.some(id => rule.immune_channels.includes(id)) ||
      rule.immune_roles.some(role => message.member!.roles.cache.has(role));

    const deleteMessage = () => message.delete().catch(() => null);

    for (const rule of groupRules[AutomodType.Filter]) {
      if (isImmune(rule) || !rule.enabled) continue;

      Logger.info(`[Automod] Filter rule triggered in ${message.guild.name} (${message.guild.id})`);

      if (MessageCreate._containsProhibitedContent(message.content, rule.details.content)) {
        await deleteMessage();
        return;
      }
    }
  }

  private static _containsProhibitedContent(message: string, prohibitedContent: string[]): boolean {
    if (!prohibitedContent.length) return false;

    // Normalize the message
    const normalizedMessage = message
      .toLowerCase()
      .replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '')
      .replace(/[^\w\s]/gi, '');

    const normalizedSet = new Set(
      prohibitedContent.map(word =>
        word
          .toLowerCase()
          .replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '')
          .replace(/[^\w\s]/gi, '')
      )
    );

    if (normalizedSet.has(normalizedMessage)) return true;

    const patterns = prohibitedContent.map(word => {
      const normalizedWord = word
        .toLowerCase()
        .replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '')
        .replace(/[^\w\s]/gi, '');

      const spacedPattern = normalizedWord.split('').join('[\\s\\u200B-\\u200D\\uFEFF\\u00A0]*');
      const l33tPattern = normalizedWord
        .replace(/a/g, '[a@4]')
        .replace(/i/g, '[i1!]')
        .replace(/e/g, '[e3]')
        .replace(/o/g, '[o0]')
        .replace(/s/g, '[s$5]')
        .split('')
        .join('[\\s\\u200B-\\u200D\\uFEFF\\u00A0]*');

      return {
        spaced: new RegExp(spacedPattern, 'i'),
        l33t: new RegExp(l33tPattern, 'i')
      };
    });

    return patterns.some(pattern => pattern.spaced.test(message) || pattern.l33t.test(message));
  }
}
