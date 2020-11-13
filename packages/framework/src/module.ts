/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ModuleOptions} from './decorator';
import {ClassSchema, ExtractClassDefinition, ExtractClassType, PlainSchemaProps, t} from '@deepkit/type';
import {ConfigDefinition} from './injector/injector';

type DefaultObject<T> = T extends undefined ? {} : T;
type ExtractConfig<T> = T extends ConfigDefinition<infer K> ? ExtractClassType<K> : (T extends PlainSchemaProps ? ExtractClassDefinition<T> : {});
export type ModuleConfigOfOptions<O extends ModuleOptions> = ExtractConfig<DefaultObject<O['config']>>;

export class Module<T extends ModuleOptions = ModuleOptions> {
    public root: boolean = false;

    constructor(
        public readonly options: T,
        public readonly configValues: Partial<ModuleConfigOfOptions<T>> = {},
    ) {
        if (options.config instanceof ConfigDefinition) {
            options.config.setModule(this);
        }
    }

    clone(): Module<T> {
        return new Module(this.options, this.configValues);
    }

    getName(): string {
        return this.options.name || '';
    }

    configured(config: Partial<ModuleConfigOfOptions<T>>): Module<T> {
        const m = new Module(this.options, config);
        m.root = this.root;
        return m;
    }

    forRoot() {
        const m = this.clone();
        m.root = true;
        return m;
    }
}

export function createModule<O extends ModuleOptions>(options: O): Module<O> {
    return new Module(options);
}
