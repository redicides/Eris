-- CreateEnum
CREATE TYPE "InfractionType" AS ENUM ('Warn', 'Mute', 'Kick', 'Ban', 'Unmute', 'Unban');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('Mute', 'Ban');

-- CreateEnum
CREATE TYPE "InfractionFlag" AS ENUM ('Automatic', 'Native', 'Quick');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Pending', 'Disregarded', 'Accepted', 'Denied');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('Pending', 'Accepted', 'Denied');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "commandDisabledList" TEXT[],
    "commandErrorTTL" INTEGER NOT NULL DEFAULT 7500,
    "commandTemporaryReplyTTL" INTEGER NOT NULL DEFAULT 5000,
    "componentErrorTTL" INTEGER NOT NULL DEFAULT 5000,
    "componentTemporaryReplyTTL" INTEGER NOT NULL DEFAULT 5000,
    "messageReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "messageReportsWebhook" TEXT,
    "messageReportsImmuneRoles" TEXT[],
    "messageReportsPingRoles" TEXT[],
    "messageReportsBlacklist" TEXT[],
    "messageReportsRequireMember" BOOLEAN NOT NULL DEFAULT true,
    "messageReportsDisregardAfter" BIGINT NOT NULL DEFAULT 2592000000,
    "messageReportsNotifyStatus" BOOLEAN NOT NULL DEFAULT true,
    "messageReportsRequireAcceptReason" BOOLEAN NOT NULL DEFAULT false,
    "messageReportsRequireDenyReason" BOOLEAN NOT NULL DEFAULT false,
    "userReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userReportsWebhook" TEXT,
    "userReportsImmuneRoles" TEXT[],
    "userReportsPingRoles" TEXT[],
    "userReportsBlacklist" TEXT[],
    "userReportsRequireMember" BOOLEAN NOT NULL DEFAULT true,
    "userReportsDisregardAfter" BIGINT NOT NULL DEFAULT 2592000000,
    "userReportsNotifyStatus" BOOLEAN NOT NULL DEFAULT true,
    "userReportsRequireAcceptReason" BOOLEAN NOT NULL DEFAULT false,
    "userReportsRequireDenyReason" BOOLEAN NOT NULL DEFAULT false,
    "reportLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reportLoggingWebhook" TEXT,
    "banRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "banRequestsWebhook" TEXT,
    "banRequestsImmuneRoles" TEXT[],
    "banRequestsImmuneUsers" TEXT[],
    "muteRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "muteRequestsWebhook" TEXT,
    "muteRequestsImmuneRoles" TEXT[],
    "muteRequestsImmuneUsers" TEXT[],
    "requireWarnReason" BOOLEAN NOT NULL DEFAULT true,
    "requireMuteReason" BOOLEAN NOT NULL DEFAULT true,
    "requireKickReason" BOOLEAN NOT NULL DEFAULT true,
    "requireBanReason" BOOLEAN NOT NULL DEFAULT true,
    "requireUnmuteReason" BOOLEAN NOT NULL DEFAULT false,
    "requireUnbanReason" BOOLEAN NOT NULL DEFAULT false,
    "notifyWarnAction" BOOLEAN NOT NULL DEFAULT true,
    "notifyMuteAction" BOOLEAN NOT NULL DEFAULT true,
    "notifyKickAction" BOOLEAN NOT NULL DEFAULT true,
    "notifyBanAction" BOOLEAN NOT NULL DEFAULT true,
    "notifyUnmuteAction" BOOLEAN NOT NULL DEFAULT true,
    "defaultWarnDuration" BIGINT NOT NULL DEFAULT 0,
    "defaultMuteDuration" BIGINT NOT NULL DEFAULT 0,
    "defaultBanDuration" BIGINT NOT NULL DEFAULT 0,
    "nativeModerationIntegration" BOOLEAN NOT NULL DEFAULT true,
    "infractionLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "infractionLoggingWebhook" TEXT,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Infraction" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "requestId" TEXT,
    "type" "InfractionType" NOT NULL DEFAULT 'Warn',
    "reason" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "expiresAt" BIGINT,
    "flag" "InfractionFlag",

    CONSTRAINT "Infraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "infractionId" INTEGER NOT NULL,
    "type" "TaskType" NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "messageUrl" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT,
    "reportedAt" BIGINT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reportReason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'Pending',
    "resolvedAt" BIGINT,
    "resolvedBy" TEXT,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reportedAt" BIGINT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reportReason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'Pending',
    "resolvedAt" BIGINT,
    "resolvedBy" TEXT,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'Pending',
    "resolvedAt" BIGINT,
    "resolvedBy" TEXT,
    "requestedAt" BIGINT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "expiresAt" BIGINT,
    "reason" TEXT NOT NULL,

    CONSTRAINT "BanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuteRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'Pending',
    "resolvedAt" BIGINT,
    "resolvedBy" TEXT,
    "requestedAt" BIGINT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "MuteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Task_infractionId_key" ON "Task"("infractionId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_targetId_guildId_type_key" ON "Task"("targetId", "guildId", "type");

-- AddForeignKey
ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_infractionId_fkey" FOREIGN KEY ("infractionId") REFERENCES "Infraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanRequest" ADD CONSTRAINT "BanRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuteRequest" ADD CONSTRAINT "MuteRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
