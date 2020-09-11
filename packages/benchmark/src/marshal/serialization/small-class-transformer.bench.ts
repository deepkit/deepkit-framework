import {BenchSuite} from '@super-hornet/core';
import {plainSerializer} from '@super-hornet/marshal';
import {
    classToPlain,
    plainToClass
} from "class-transformer";

export class Model {
    public id?: number;
    public name?: string;

    ready?: boolean;

    tags: string[] = [];

    priority: number = 0;
}

export async function main() {
    const suite = new BenchSuite('class-transformer');
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    };

    suite.add('deserialize', () => {
        plainToClass(Model, plain);
    });

    const item = plainToClass(Model, plain);
    suite.add('serialize', () => {
        classToPlain(item);
    });

    suite.run();
}
