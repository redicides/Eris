import { z } from 'zod';

// ————————————————————————————————————————————————————————————————————————————————
// Miscellaneous
// ————————————————————————————————————————————————————————————————————————————————

/**
 * Discord snowflake ID schema
 */
const zSnowflake = z.string().regex(/^\d{17,19}$/gm);

/**
 * Cron schema
 */

const zCron = z
  .string()
  .regex(
    /^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|([\d*]+[/-]\d+)|\d+|\*) ?){5,7})$/gm
  );

// ————————————————————————————————————————————————————————————————————————————————
// Global Configuration
// ————————————————————————————————————————————————————————————————————————————————

/**
 * The global configuration schema exported for parsing.
 */

export const globalConfigSchema = z.object({
  developers: z.array(zSnowflake).default([]),
  database: z.object({
    task_runner_cron: zCron
  }),
  commands: z.object({
    error_ttl: z.number().default(7500),
    reply_ttl: z.number().default(10000)
  })
});

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
