import { ClassType } from '@deepkit/core';
import { AppModule } from '@deepkit/app';

export class HttpControllers {
    constructor(public readonly controllers: {controller: ClassType, module: AppModule<any, any>}[] = []) {
    }

    public add(controller: ClassType, module: AppModule<any>) {
        this.controllers.push({controller, module});
    }
}
