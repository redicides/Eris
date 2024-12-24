import { Events, GuildBan } from 'discord.js';
import { client, prisma } from '..';

import EventListener from '@managers/events/EventListener';

export default class GuildBanAdd extends EventListener {
  constructor() {
    super(Events.GuildBanAdd);
  }

  async execute(ban: GuildBan) {
    /**
     * Automatically resolve all reports and mute requests for the banned user as they can no longer be acted upon.
     *
     * ❗ TODO: This is a very basic implementation and should be improved upon. Additionally, a config option should be added
     *     in the server config to enable/disable this feature.
     */

    return Promise.all([
      GuildBanAdd._updateMessageReports(ban.user.id, ban.guild.id),
      GuildBanAdd._updateUserReports(ban.user.id, ban.guild.id),
      GuildBanAdd._updateMuteRequests(ban.user.id, ban.guild.id)
    ]);
  }

  private static async _updateMessageReports(author_id: string, guild_id: string) {
    return prisma.messageReport.updateMany({
      where: {
        author_id,
        guild_id
      },
      data: {
        resolved_at: new Date(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }

  private static async _updateUserReports(target_id: string, guild_id: string) {
    return prisma.userReport.updateMany({
      where: {
        target_id,
        guild_id
      },
      data: {
        resolved_at: new Date(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }

  private static async _updateMuteRequests(target_id: string, guild_id: string) {
    return prisma.muteRequest.updateMany({
      where: {
        target_id,
        guild_id
      },
      data: {
        resolved_at: new Date(),
        resolved_by: client.user!.id,
        status: 'AutoResolved'
      }
    });
  }
}
