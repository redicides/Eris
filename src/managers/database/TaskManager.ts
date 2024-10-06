import { Snowflake } from 'discord.js';

import { prisma } from '@/index';
import { Prisma, Task, TaskType } from '@prisma/client';

export default class TaskManager {
  public static async storeTask(data: {
    guildId: Snowflake;
    targetId: Snowflake;
    infractionId: number;
    expiresAt: bigint | number;
    type: TaskType;
  }): Promise<Task> {
    return prisma.task.upsert({
      where: { targetId_guildId_type: { guildId: data.guildId, targetId: data.targetId, type: data.type } },
      update: data,
      create: data
    });
  }

  public static async getTask(options: Prisma.TaskFindUniqueArgs): Promise<Task | null> {
    return prisma.task.findUnique({
      where: options.where,
      include: options.include
    });
  }

  public static async deleteTask(options: Prisma.TaskDeleteArgs): Promise<Task | null> {
    return prisma.task.delete({ where: options.where, include: options.include });
  }
}
