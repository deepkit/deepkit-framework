import { ClassType } from '@deepkit/core';
import { InjectorModule } from '@deepkit/injector';

export class HttpControllers {
    constructor(public readonly controllers: { controller: ClassType; module: InjectorModule<any> }[] = []) {}

    public add(controller: ClassType, module: InjectorModule<any>) {
        this.controllers.push({ controller, module });
    }
}
