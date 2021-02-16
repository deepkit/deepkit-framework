import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { ApplicationServiceContainer } from '../src/application-service-container';
import { rpc } from '@deepkit/rpc';
import { AppModule } from '@deepkit/app';

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
        const myModule = new AppModule({
            providers: [MyService],
            controllers: [MyController],
        });

        const serviceContainer = new ApplicationServiceContainer(myModule);
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

    const controllerModule = new AppModule({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    });

    {
        const myModule = new AppModule({
            imports: [controllerModule],
        });

        const serviceContainer = new ApplicationServiceContainer(myModule);
        const rpcScopedContext = serviceContainer.getRootInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        const myModule = new AppModule({
            providers: [
                { provide: MyService, useValue: new MyService('different') }
            ],
            imports: [controllerModule],
        });

        const serviceContainer = new ApplicationServiceContainer(myModule);
        const rpcScopedContext = serviceContainer.getRootInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('different');
    }
});
