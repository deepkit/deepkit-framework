import { expect, test } from '@jest/globals';
import { createModule, createModuleConfig } from '../src/module';
import { getClassSchema, t } from '@deepkit/type';
import { inject, injectable } from '@deepkit/injector';
import { ServiceContainer } from '../src/service-container';

test('clone', () => {
    class RootApp extends createModule({}) {
    }

    const app = new RootApp;

    expect(app !== app.clone()).toBe(true);
});

test('no config reference leak', () => {
    class ModuleA extends createModule({
        config: createModuleConfig({
            param1: t.string.optional,
        })
    }, 'myModule') {
    }

    class RootApp extends createModule({
        imports: [new ModuleA],
    }) {
    }

    // expect(new ModuleA().getConfig()).toMatchObject({ param1: undefined });
    const app = new RootApp({ myModule: { param1: '1' } });
    expect(new RootApp().getImports()[0] !== app.getImports()[0]).toBe(true);

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });

    expect(new ModuleA().getConfig()).toMatchObject({ param1: undefined });

    expect(new RootApp().getImports()[0].getConfig()).toMatchObject({ param1: undefined });

    expect(new RootApp({ myModule: { param1: '2' } }).getImports()[0].getConfig()).toMatchObject({ param1: '2' });

    expect(app.getImports()[0].getConfig()).toMatchObject({ param1: '1' });
});

test('constructor argument hole', () => {
    class Logger {
    }

    class Stopwatch {
    }

    @injectable()
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

    @injectable()
    class Service {
        constructor(
            @inject(moduleAConfig.token('nested')) public settings: typeof moduleAConfig.config['nested'],
            @inject(moduleAConfig.token('param1')) public param1: string,
        ) {
        }
    }

    class ModuleA extends createModule({
        config: moduleAConfig,
        providers: [
            Service
        ]
    }, 'moduleA') {
    }

    class RootApp extends createModule({
        imports: [
            new ModuleA({ param1: 'a', nested: { param2: 'b' } })
        ],
    }) {
    }

    expect(new ModuleA({ param1: 'a', nested: { param2: 'b' } }).getConfig()).toEqual({
        param1: 'a', nested: { param2: 'b' }
    });


    expect(new RootApp({ moduleA: { param1: 'a', nested: { param2: 'b' } } }).getImports()[0].getConfig()).toEqual({
        param1: 'a', nested: { param2: 'b' }
    });

    const serviceContainer = new ServiceContainer(new RootApp({ moduleA: { param1: 'a', nested: { param2: 'b' } } }));
    expect(serviceContainer.getModuleForModuleClass(ModuleA).getConfig()).toEqual({
        param1: 'a', nested: { param2: 'b' }
    });
    expect(serviceContainer.getInjectorForModuleClass(ModuleA).get(Service).param1).toEqual('a');

    const nested = serviceContainer.getInjectorForModuleClass(ModuleA).get(Service).settings;
    expect(nested).toEqual({ param2: 'b' });
});
