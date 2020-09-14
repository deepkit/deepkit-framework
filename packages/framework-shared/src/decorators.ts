import {ClassType} from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    getClassSchema,
    mergeDecorator,
    PropertyDecoratorResult,
    PropertySchema,
} from '@deepkit/type';

class RpcController {
    name: string = '';

    actions = new Map;
}

class RpcAction {
}

class RpcClass {
    t = new RpcController;

    controller(name: string) {
        this.t.name = name;
    }

    addAction(name: string, action: RpcAction) {
        this.t.actions.set(name, action);
    }
}
export const rpcClass: ClassDecoratorResult<typeof RpcClass> = createClassDecoratorContext(RpcClass);

class RpcProperty {
    t = new RpcAction;

    onDecorator(target: object, property?: string) {
        rpcClass.addAction(property!, this.t)(target);
    }

    action() {
    }
}

export const rpcProperty: PropertyDecoratorResult<typeof RpcProperty> = createPropertyDecoratorContext(RpcProperty);

export const rpc: typeof rpcClass & typeof rpcProperty = mergeDecorator(rpcClass, rpcProperty) as any;

export function getActionParameters<T>(target: ClassType<T>, method: string): PropertySchema[] {
    return getClassSchema(target).getMethodProperties(method);
}

export function getActions<T>(target: ClassType<T>): Map<string, RpcAction> {
    return rpcClass._fetch(target)?.actions ?? new Map;
}
