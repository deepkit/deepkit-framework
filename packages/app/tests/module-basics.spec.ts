import { expect, test } from '@jest/globals';
import { createModule, createModuleConfig } from '../src/module';
import { getClassSchema, t } from '@deepkit/type';
import { inject, injectable } from '@deepkit/injector';
import { ServiceContainer } from '../src/service-container';
import { assert, IsExact } from 'conditional-type-checks';

test('strict types config', () => {
    const config = createModuleConfig({
        host: t.string,
    });

    class MyModule extends createModule({
        config
    }) {
        process() {
            //at this point the validation happened and it can be assumed the config has the right types
            const config = this.config;
            assert<IsExact<{ host: string }, typeof config>>(true);
        }
    }
});

test('no config reference leak', () => {
    class ModuleA extends createModule({
        config: createModuleConfig({
            param1: t.string.optional,
        })
    }, 'myModule') {
    }

    class RootApp extends createModule({
        config: createModuleConfig({
            value: t.string
        })
    }) {
        override imports = [new ModuleA];
        override process() {
            this.getImportedModuleByClass(ModuleA).configure({param1: this.config.value});
        }
    }

    expect(new ModuleA().getConfig()).toMatchObject({ param1: undefined });

    const app = new RootApp({value: '1'});
    app.process();
    expect(new RootApp().getImports()[0] !== app.getImports()[0]).toBe(true);

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });

    expect(new ModuleA().getConfig()).toMatchObject({ param1: undefined });

    expect(new RootApp().getImports()[0].getConfig()).toMatchObject({ param1: undefined });

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });
});

test('constructor argument hole', () => {
    class Logger {
    }

    class Stopwatch {
    }

    @injectable
    class Service {
        constructor(public stopwatch: Stopwatch, @inject(Logger) public logger: any) {
        }
    }

    {
        const schema = getClassSchema(Service);
        const methods = schema.getMethodProperties('constructor');
        expect(methods.length).toBe(2);
        expect(methods[0].name).toBe('stopwatch');
        expect(methods[1].name).toBe('logger');
    }
});

test('nested config', () => {
    const moduleAConfig = createModuleConfig({
        param1: t.string,
        nested: {
            param2: t.string
        }
    });

    @injectable
    class Service {
        constructor(
            @inject(moduleAConfig.token('nested')) public settings: typeof moduleAConfig.config['nested'],
            @inject(moduleAConfig.token('param1')) public param1: string,
        ) {
        }
    }

    let moduleAProcessCalled = 0;
    class ModuleA extends createModule({
        config: moduleAConfig,
        providers: [
            Service
        ]
    }, 'moduleA') {
        process() {
            moduleAProcessCalled++;
        }
    }

    class RootApp extends createModule({}) {
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
