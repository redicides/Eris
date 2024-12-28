import { Collection } from 'discord.js';

import path from 'path';
import fs from 'fs';

import { pluralize } from '@utils/index';

import Logger, { AnsiColor } from '@utils/Logger';
import Component, { CustomID } from '@eris/Component';

export default class ComponentManager {
  /**
   * The cached components.
   */
  public static readonly components = new Collection<CustomID, Component>();

  /**
   * Caches all components from the components directory.
   * @returns void
   */
  static async cache() {
    const dirpath = path.resolve('src/components');

    if (!fs.existsSync(dirpath)) {
      Logger.info(`Skipping component caching: components directory not found.`);
      return;
    }

    let componentCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const componentModule = require(`../../../components/${file.slice(0, -3)}`);
        const componentClass = componentModule.default;
        const component = new componentClass();

        if (!(component instanceof Component)) {
          Logger.warn(`Skipping component caching: ${file} is not an instance of Component.`);
          continue;
        }

        ComponentManager.components.set(component.customId, component);
        const parsedCustomId = ComponentManager.parseCustomId(component.customId);

        Logger.log('GLOBAL', `Cached component "${parsedCustomId}"`, {
          color: AnsiColor.Purple
        });

        componentCount++;
      }
    } catch (error) {
      Logger.error(`Error when caching components:`, error);
    } finally {
      Logger.info(`Cached ${componentCount} ${pluralize(componentCount, 'component')}.`);
    }
  }

  /**
   * Parses a string/object custom ID to a string.
   *
   * @param customId - The custom ID to parse.
   * @returns The parsed custom ID as a string.
   */
  static parseCustomId(customId: CustomID): string {
    if (typeof customId === 'string') {
      return customId;
    }

    switch (true) {
      case 'matches' in customId:
        return `matches(${customId.matches.toString()})`;
      case 'startsWith' in customId:
        return `startsWith(${customId.startsWith})`;
      case 'endsWith' in customId:
        return `endsWith(${customId.endsWith})`;
      case 'includes' in customId:
        return `includes(${customId.includes})`;
      default:
        return 'unknown';
    }
  }

  /**
   * Retrieves a component by its custom ID.
   *
   * @param customId The custom ID to search for
   * @returns The component, if found
   */

  public static getComponent(customId: string): Component | undefined {
    return ComponentManager.components.find(component => {
      if (typeof component.customId === 'string') {
        return component.customId === customId;
      }

      if ('matches' in component.customId) {
        return customId.match(component.customId.matches);
      }

      if ('startsWith' in component.customId) {
        return customId.startsWith(component.customId.startsWith);
      }

      if ('endsWith' in component.customId) {
        return customId.endsWith(component.customId.endsWith);
      }

      return customId.includes(component.customId.includes);
    });
  }
}
