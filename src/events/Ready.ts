import { Events } from 'discord.js';

import { CronUtils } from '@utils/Cron';

import EventListener from '@managers/events/EventListener';
import ConfigManager from '@managers/config/ConfigManager';
import Logger, { AnsiColor } from '@utils/Logger';

export default class Ready extends EventListener {
  constructor() {
    super(Events.ClientReady);
  }

  async execute() {
    Logger.log(`READY`, `Successfully logged in as ${this.client.user!.tag}.`, {
      color: AnsiColor.Green,
      full: true
    });

    if (ConfigManager.global_config.bot.activity) {
      const { type, name } = ConfigManager.global_config.bot.activity;
      this.client.user!.setActivity({ name, type });
    }

    // Start cron jobs
    CronUtils.startTaskRunner();
    CronUtils.startReportDisregardRunner();
    CronUtils.startMessageRunners();
  }
}
