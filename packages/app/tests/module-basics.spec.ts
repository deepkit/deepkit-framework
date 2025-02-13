import { expect, test } from '@jest/globals';
import { createModuleClass } from '../src/module.js';
import { ServiceContainer } from '../src/service-container.js';
import { assert, IsExact } from 'conditional-type-checks';

test('strict types config', () => {
    class Config {
        host!: string;
    }

    class MyModule extends createModuleClass({
        config: Config
    }) {
        process() {
            //at this point the validation happened and it can be assumed the config has the right types
            const config = this.config;
            assert<IsExact<{ host: string }, typeof config>>(true);
        }
    }
});

test('strict types config with defaults', () => {
    class Config {
        host: string = '0.0.0.0';
    }

    class MyModule extends createModuleClass({
        config: Config
    }) {
        process() {
            //at this point the validation happened and it can be assumed the config has the right types
            const config = this.config;
            assert<IsExact<{ host: string }, typeof config>>(true);
        }
    }
});

test('nested options are optional as well for constructor, but strict in process()', () => {
    class Config {
        host: string = '0.0.0.0';
        secret!: string;
        nested?: {
            enabled: boolean,
            type: string
        };
    }

    class MyModule extends createModuleClass<Config>({
        config: Config
    }) {
        process() {
            const config = this.config;
            if (config.nested) {
                const nested = config.nested;
                assert<IsExact<string, typeof nested['type']>>(true);
            }
        }
    }

    new MyModule({ host: '0.0.0.0', nested: { enabled: true } });
});

test('partial nested options are optional as well for constructor, but strict in process()', () => {
    class Config {
        host: string = '0.0.0.0';
        secret!: string;
        nested?: {
            enabled: boolean,
            type: string
        };
    }

    class MyModule extends createModuleClass({
        config: Config
    }) {
        process() {
            const config = this.config;
            if (config.nested) {
                const nested = config.nested;
                assert<IsExact<string, typeof nested['type']>>(true);
            }
        }
    }

    new MyModule({ host: '0.0.0.0', nested: { enabled: true } });
});

test('no config reference leak', () => {
    class ModuleA extends createModuleClass({
        config: class {
            param1?: string;
        }
    }) {
    }

    class RootApp extends createModuleClass({
        config: class {
            value!: string;
        }
    }) {
        override imports = [new ModuleA];

        override process() {
            this.getImportedModuleByClass(ModuleA).configure({ param1: this.config.value });
        }
    }

    expect(new ModuleA().getConfig()).toEqual({});

    const app = new RootApp({ value: '1' });
    app.process();
    expect(new RootApp().getImports()[0] !== app.getImports()[0]).toBe(true);

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });

    expect(new ModuleA().getConfig()).toEqual({});

    expect(new RootApp().getImports()[0].getConfig()).toEqual({});

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });
});

test('nested config', () => {
    class ModuleAConfig {
        param1!: string;
        nested!: {
            param2: string
        };
    }

    class Service {
        constructor(
            public settings: ModuleAConfig['nested'],
            public param1: ModuleAConfig['param1'],
        ) {
        }
    }

    let moduleAProcessCalled = 0;

    class ModuleA extends createModuleClass({
        config: ModuleAConfig,
        providers: [
            Service
        ]
    }) {
        process() {
            moduleAProcessCalled++;
        }
    }

    class RootApp extends createModuleClass({}) {
        process() {
            this.addImport(new ModuleA({ param1: 'a', nested: { param2: 'b' } }));
        }
    }

    const serviceContainer = new ServiceContainer(new RootApp());
    serviceContainer.process();
    expect(moduleAProcessCalled).toBe(1);
    expect(serviceContainer.getModule(ModuleA).getConfig()).toEqual({
        param1: 'a', nested: { param2: 'b' }
    });
    expect(serviceContainer.getInjector(ModuleA).get(Service).param1).toEqual('a');

    const nested = serviceContainer.getInjector(ModuleA).get(Service).settings;
    expect(nested).toEqual({ param2: 'b' });
});
