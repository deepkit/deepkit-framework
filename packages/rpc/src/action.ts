import { ClassType } from '@deepkit/core';
import { InjectorContext, InjectorModule, Scope } from '@deepkit/injector';
import { getActions, rpcClass } from './decorators.js';
import { getAction } from './protocol.js';

export class ActionDispatcher {
    protected actions: ((message: Uint8Array, scope: Scope) => void)[] = [];

    protected mappings: { [name: string]: number } = {};

    build(injector: InjectorContext, controllers: Iterable<{ name: string, controller: ClassType, module: InjectorModule }>) {
        this.actions = [];
        this.mappings = {};

        for (const controller of controllers) {
            const resolver = injector.resolver(controller.module, controller.controller);
            const knownActions = getActions(controller.controller);

            let controllerName = controller.name;

            const rpcConfig = rpcClass._fetch(controller.controller);
            if (rpcConfig) controllerName = rpcConfig.getPath();

            for (const [name, action] of knownActions) {
                this.mappings[controllerName + '_' + name] = this.actions.length;

                this.actions.push(function(message, scope) {
                    const controller = resolver(scope);
                    controller[name]();
                });
            }
        }
    }

    dispatch(message: Uint8Array, scope: Scope) {
        const actionId = getAction(message);
        try {
            this.actions[actionId](message, scope);
        } catch (e) {
            console.log(`Cannot execute action ${actionId}`, e);
        }
    }
}

