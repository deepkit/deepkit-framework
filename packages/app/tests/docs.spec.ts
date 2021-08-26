import { expect, test } from '@jest/globals';
import { ClassType } from '@deepkit/core';
import { App } from '../src/app';
import { AppModule, createModule } from '../src/module';
import { injectable, InjectorContext } from '@deepkit/injector';

test('controller instantiation', () => {
    class Registry {
        protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];

        register(module: AppModule<any>, controller: ClassType) {
            this.controllers.push({ module, classType: controller });
        }

        get(classType: ClassType) {
            const controller = this.controllers.find(v => v.classType === classType);
            if (!controller) throw new Error('Controller unknown');
            return controller;
        }
    }

    @injectable()
    class Router {
        constructor(
            protected injectorContext: InjectorContext,
            protected registry: Registry
        ) {
        }

        getController(classType: ClassType) {
            //find classType and module for given controller classType
            const controller = this.registry.get(classType);

            //get the dependency injection sub container for the module
            const injector = this.injectorContext.getInjectorForModule(controller.module);

            //here the controller will be instantiated. If it was already
            //instantiated, the old instanced will be returned.
            return injector.get(controller.classType);
        }
    }

    class HttpModule extends createModule({
        providers: [Router],
        exports: [Router],
    }) {
        protected registry = new Registry;

        process() {
            this.addProvider({ provide: Registry, useValue: Registry });
        }

        handleControllers(module: AppModule<any>, controllers: ClassType[]) {
            for (const controller of controllers) {
                //controllers need to be put into the module's providers by the controller consumer
                if (!module.isProvided(controller)) module.addProvider(controller);
                this.registry.register(module, controller);
            }
        }
    }

    class MyController {}

    const app = new App({
        controllers: [MyController],
        imports: [new HttpModule()]
    });

    const myController = app.get(Router).getController(MyController);
    expect(myController).toBeInstanceOf(MyController);
});
