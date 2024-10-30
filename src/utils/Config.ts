import { GuildMember } from 'discord.js';
import { PermissionEnum } from '@prisma/client';

import { GuildConfig } from './Types';

export class ConfigUtils {
  /**
   * Checks if a member has a specific permission.
   * @param member The member to check
   * @param config The guild config ( with permissions )
   * @param permission The permission to check for
   */
  public static hasPermission(member: GuildMember, config: GuildConfig, permission: PermissionEnum): boolean {
    return member.roles.cache.some(role => {
      return config.permissions.some(permissions => {
        return permissions.roleIds.includes(role.id) && permissions.permissions.includes(permission);
      });
    });
  }
}
