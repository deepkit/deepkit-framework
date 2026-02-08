import { ClassType, getClassName } from '@deepkit/core';

import { Database } from '../database.js';

export interface DatabasePlugin {
    onRegister(database: Database<any>): void;
}

export class DatabasePluginRegistry {
    protected plugins: DatabasePlugin[] = [];

    add(plugin: DatabasePlugin): void {
        this.plugins.push(plugin);
    }

    hasPlugin<T>(classType: ClassType<T>): boolean {
        for (const plugin of this.plugins) if (plugin instanceof classType) return true;
        return false;
    }

    getPlugins<T>(classType: ClassType<T>): T[] {
        return this.plugins.filter(v => v instanceof classType) as T[];
    }

    getPlugin<T>(classType: ClassType<T>): T {
        for (const plugin of this.plugins) {
            if (plugin instanceof classType) return plugin;
        }
        throw new Error(`No plugin for ${getClassName(classType)} registered.`);
    }
}
