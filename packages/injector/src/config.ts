import { ClassType } from '@deepkit/core';
import { ClassSchema, ExtractClassDefinition, jsonSerializer, PlainSchemaProps, t } from '@deepkit/type';

export class ConfigToken<T extends {}> {
    constructor(public config: ConfigDefinition<T>, public name: keyof T & string) {
    }
}

export class ConfigSlice<T extends {}> {
    public bag?: { [name: string]: any };
    public config!: ConfigDefinition<T>;

    constructor(config: ConfigDefinition<T>, names: (keyof T & string)[]) {
        //we want that ConfigSlice acts as a regular plain object, which can be serialized at wish.
        let bag: { [name: string]: any } = {};

        Object.defineProperties(this, {
            config: { enumerable: false, get: () => config },
            bag: { enumerable: false, set: (v) => bag = v },
        });

        for (const name of names) {
            Object.defineProperty(this, name, {
                enumerable: true,
                get: () => bag[name]
            });
        }
    }

    valueOf() {
        return { ...this };
    }
}

export class ConfigDefinition<T extends {}> {
    public type!: T;

    constructor(
        public readonly schema: ClassSchema<T>
    ) {
    }

    getDefaults(): any {
        return jsonSerializer.for(this.schema).validatedDeserialize({});
    }

    all(): ClassType<T> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, [...self.schema.getProperties()].map(v => v.name) as any);
            }
        } as any;
    }

    slice<N extends (keyof T & string)[]>(...names: N): ClassType<Pick<T, N[number]>> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, names);
            }
        } as any;
    }

    token<N extends (keyof T & string)>(name: N): ConfigToken<T> {
        return new ConfigToken(this, name);
    }
}

export function createConfig<T extends PlainSchemaProps>(config: T): ConfigDefinition<ExtractClassDefinition<T>> {
    return new ConfigDefinition(t.schema(config));
}
