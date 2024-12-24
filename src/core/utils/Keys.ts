import { GuildMember, PermissionsBitField, User } from 'discord.js';
import { InfractionAction } from '@prisma/client';

import { UserPermission } from './Enums';

export const MessageKeys = {
  Errors: {
    InvalidTarget: 'The provided target is invalid.',
    TargetNotFound: 'The target user could not be found.',
    MemberNotFound: 'The target member could not be found.',
    CommandNotFound: 'The provided command could not be found.',
    CommandDisabled: 'This command is disabled in this guild.',
    CommandRateLimited:
      'Another process of this command is already running. You must wait for it to finish before running this command again.',
    CantUnmuteUnmutedMember: `You cannot unmute someone who is not muted.`,
    CantMuteAdmin: `You cannot mute an Administrator.`,

    InvalidDuration(canBePermanent: boolean = true) {
      return `Invalid duration. The valid formats are \`<number>[s/m/h/d]\`, \`<number> [second/minute/hour/day]\`${
        canBePermanent ? `, or ${DurationKeys.Permanent.map(key => `\`${key}\``).join(', ')}` : ''
      }.`;
    },

    DurationTooShort(duration: string) {
      return `The duration must be at least ${duration}.`;
    },

    DurationTooLong(duration: string) {
      return `The duration must not exceed ${duration}.`;
    },

    MissingPermissions(permissions: bigint | bigint[]) {
      const bitField = new PermissionsBitField(permissions);
      return `I require the following permissions to run this command: \`${bitField
        .toArray()
        .join(', ')
        .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`;
    },

    MissingUserPermission(permission: UserPermission, action: string) {
      return `You must have the \`${permission}\` permission to ${action}.`;
    },

    PunishmentFailed(action: Exclude<InfractionAction, 'Warn'>, target: User | GuildMember) {
      return `Failed to ${action.toLowerCase()} ${target}. The related infraction has been deleted.`;
    },

    InfractionNotFound(id: string) {
      return `An infraction with the ID \`${id}\` could not be found.`;
    },

    InadequateUserHierarchy(action: string) {
      return `You cannot ${action} someone with higher or equal roles than you.`;
    },

    InadequateBotHierarchy(action: string) {
      return `I cannot ${action} someone with higher or equal roles than me.`;
    },

    ReasonRequired(action: string) {
      return `You must provide a reason to ${action}.`;
    },

    CantPunishSelf(action: string) {
      return `You cannot ${action.toLowerCase()} yourself.`;
    },

    CantPunishBot(action: string) {
      return `You cannot ${action.toLowerCase()} me.`;
    },

    CantPunishServerOwner(action: string) {
      return `You cannot ${action.toLowerCase()} the server owner.`;
    }
  }
};

export const DurationKeys = {
  Permanent: ['permanent', 'perm', 'p', 'infinity', 'inf', 'forever', 'never']
};
