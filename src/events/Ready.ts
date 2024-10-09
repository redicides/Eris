import { Events } from 'discord.js';

import { CronUtils } from '@utils/Cron';

import EventListener from '@/managers/events/EventListener';
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

    CronUtils.startTaskRunner();
  }
}
