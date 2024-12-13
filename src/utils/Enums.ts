/**
 * Enums used for permission nodes.
 *
 * Since PostgreSQL doesn't yet support composite types & prisma won't export enums without them being used somewhere in the schema,
 * we manually export them from a file like here.
 */

export enum UserPermission {
  // Infractions
  SearchInfractions = 'SearchInfractions',
  DeleteInfractions = 'DeleteInfractions',
  UpdateInfractions = 'UpdateInfractions',
  // Reports
  ManageMessageReports = 'ManageMessageReports',
  ManageUserReports = 'ManageUserReports',
  // Requests
  ManageMuteRequests = 'ManageMuteRequests',
  ManageBanRequests = 'ManageBanRequests',
  // Lock
  LockChannels = 'LockChannels',
  UnlockChannels = 'UnlockChannels',
  StartLockdown = 'StartLockdown',
  EndLockdown = 'EndLockdown',
  OverrideLockdownNotificatons = 'OverrideLockdownNotificatons'
}
