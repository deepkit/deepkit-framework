import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { ApplicationServiceContainer } from '../src/application-service-container';
import { rpc } from '@deepkit/rpc';
import { createModule } from '@deepkit/command';

test('controller', () => {
    class MyService {
        constructor(private text: string = 'hello') {
        }

        getHello() {
            return this.text;
        }
    }

    @rpc.controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }

        foo() {
            return this.myService.getHello();
        }
    }

    {
        const MyModule = createModule({
            providers: [MyService],
            controllers: [MyController],
        });

        const serviceContainer = new ApplicationServiceContainer(MyModule);
        const rpcScopedContext = serviceContainer.getRootInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.getInjector(0).get(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }
});

test('controller in module and overwrite service', () => {
    class MyService {
        constructor(private text: string = 'hello') {
        }

        getHello() {
            return this.text;
        }
    }

    @rpc.controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }

        foo() {
            return this.myService.getHello();
        }
    }

    const ControllerModule = createModule({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    });

    {
        const MyModule = createModule({
            imports: [ControllerModule],
        });

        const serviceContainer = new ApplicationServiceContainer(MyModule);
        const rpcScopedContext = serviceContainer.getRootInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        const MyModule = createModule({
            providers: [
                { provide: MyService, useValue: new MyService('different') }
            ],
            imports: [ControllerModule],
        });

        const serviceContainer = new ApplicationServiceContainer(MyModule);
        const rpcScopedContext = serviceContainer.getRootInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('different');
    }
});
