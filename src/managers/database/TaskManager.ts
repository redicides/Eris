import { Snowflake } from 'discord.js';
import { Prisma, Task, TaskType } from '@prisma/client';

import { prisma } from '@/index';
import { generateSnowflakeId } from '@utils/index';

export default class TaskManager {
  public static async storeTask(data: {
    guildId: Snowflake;
    targetId: Snowflake;
    infractionId: string;
    expiresAt: bigint | number;
    type: TaskType;
  }): Promise<Task> {
    return prisma.task.upsert({
      where: { targetId_guildId_type: { guildId: data.guildId, targetId: data.targetId, type: data.type } },
      update: data,
      create: {
        id: generateSnowflakeId(),
        ...data
      }
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
