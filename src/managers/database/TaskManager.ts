import { Snowflake } from 'discord.js';
import { InfractionTask, Prisma, TaskAction } from '@prisma/client';

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
    expires_at: Date;
    action: TaskAction;
  }): Promise<InfractionTask> {
    return prisma.infractionTask.upsert({
      where: { target_id_guild_id_action: { guild_id: data.guild_id, target_id: data.target_id, action: data.action } },
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

  public static async getTask(where: Prisma.InfractionTaskFindUniqueArgs['where']): Promise<InfractionTask | null> {
    return prisma.infractionTask.findUnique({
      where
    });
  }

  /**
   * Delete a task from the database.
   *
   * @param where The query options
   * @returns The task that was deleted
   */

  public static async deleteTask(where: Prisma.InfractionTaskDeleteArgs['where']): Promise<InfractionTask | null> {
    return prisma.infractionTask.delete({ where }).catch(() => null);
  }
}
