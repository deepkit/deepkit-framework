import { ClassType } from '@deepkit/core';

export class HttpControllers {
    constructor(public readonly controllers: ClassType[]) {
    }

    public add(controller: ClassType) {
        this.controllers.push(controller);
    }
}
