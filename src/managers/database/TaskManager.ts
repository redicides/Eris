import { Snowflake } from 'discord.js';
import { Prisma, Task, TaskType } from '@prisma/client';

import { prisma } from '@/index';
import { generateSnowflakeId } from '@utils/index';

export default class TaskManager {
  /**
   * Store a task in the database.
   * Tasks are used to undo actions after a certain amount of time.
   *
   * @param data The data for the task
   * @returns The task that was stored
   */
  public static async storeTask(data: {
    guild_id: Snowflake;
    target_id: Snowflake;
    infraction_id: string;
    expires_at: bigint | number;
    type: TaskType;
  }): Promise<Task> {
    return prisma.task.upsert({
      where: { target_id_guild_id_type: { guild_id: data.guild_id, target_id: data.target_id, type: data.type } },
      update: data,
      create: {
        id: generateSnowflakeId(),
        ...data
      }
    });
  }

  /**
   * Retrieve a task from the database.
   *
   * @param where The query options
   * @returns The task, if found
   */

  public static async getTask(where: Prisma.TaskFindUniqueArgs['where']): Promise<Task | null> {
    return prisma.task.findUnique({
      where
    });
  }

  /**
   * Delete a task from the database.
   *
   * @param where The query options
   * @returns The task that was deleted
   */

  public static async deleteTask(where: Prisma.TaskDeleteArgs['where']): Promise<Task | null> {
    return prisma.task.delete({ where }).catch(() => null);
  }
}
