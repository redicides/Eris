import { Events, GuildBan } from 'discord.js';
import { client, prisma } from '..';

import EventListener from '@managers/events/EventListener';

export default class GuildBanAdd extends EventListener {
  constructor() {
    super(Events.GuildBanAdd);
  }

  async execute(ban: GuildBan) {
    // Clear all reports and mute requests for the banned user as they can no longer be resolved by staff
    return Promise.all([
      GuildBanAdd._clearMessageReports(ban.user.id, ban.guild.id),
      GuildBanAdd._clearUserReports(ban.user.id, ban.guild.id),
      GuildBanAdd._clearMuteRequests(ban.user.id, ban.guild.id)
    ]);
  }

  private static async _clearMessageReports(author_id: string, guild_id: string) {
    prisma.messageReport.updateMany({
      where: {
        author_id,
        guild_id
      },
      data: {
        resolved_at: Date.now(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }

  private static async _clearUserReports(target_id: string, guild_id: string) {
    prisma.userReport.updateMany({
      where: {
        target_id,
        guild_id
      },
      data: {
        resolved_at: Date.now(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }

  private static async _clearMuteRequests(target_id: string, guild_id: string) {
    prisma.muteRequest.updateMany({
      where: {
        target_id,
        guild_id
      },
      data: {
        resolved_at: Date.now(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }
}
