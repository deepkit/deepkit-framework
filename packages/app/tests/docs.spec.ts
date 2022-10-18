import { expect, test } from '@jest/globals';
import { ClassType } from '@deepkit/core';
import { App } from '../src/app.js';
import { AppModule, createModule } from '../src/module.js';
import { InjectorContext } from '@deepkit/injector';

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

    class Router {
        constructor(
            protected injectorContext: InjectorContext,
            protected registry: Registry
        ) {
        }

        getController(classType: ClassType) {
            //find classType and module for given controller classType
            const controller = this.registry.get(classType);

            //here the controller will be instantiated. If it was already
            //instantiated, the old instanced will be returned.
            return this.injectorContext.get(controller.classType, controller.module);
        }
    }

    class HttpModule extends createModule({
        providers: [Router],
        exports: [Router],
    }) {
        protected registry = new Registry;

        process() {
            this.addProvider({ provide: Registry, useValue: this.registry });
        }

        processController(module: AppModule<any>, controller: ClassType) {
            //controllers need to be put into the module's providers by the controller consumer
            if (!module.isProvided(controller)) module.addProvider(controller);
            this.registry.register(module, controller);
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
