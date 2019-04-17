import 'jest';
import 'reflect-metadata';
import {classToPlain, Field, plainToClass} from "../core";
import {plainToClass as classTransformerPlainToClass, classToPlain as classTransformerClassToPlain} from "class-transformer";
import {bench} from "./util";


export class MarshalSuperSimple {
    constructor(
        @Field() public id: number,
        @Field() public name: string
    ) {}
}

export class ClassTransformerSuperSimple {
    public id?: number;
    public name?: string;
}

test('benchmark plainToClass', () => {
    bench('Marshal: 10000x plainToClass SuperSimple', () => {
        for (let i = 0; i < 10000; i++) {
            plainToClass(MarshalSuperSimple, {
                name: 'name' + i,
                id: i
            });
        }
    });

    bench('ClassTransformer: 10000x plainToClass SuperSimple', () => {
        for (let i = 0; i < 10000; i++) {
            classTransformerPlainToClass(ClassTransformerSuperSimple, {
                name: 'name' + i,
                id: i
            });
        }
    });
});

test('benchmark classToPlain', () => {
    bench('Marshal: 10000x classToPlain SuperSimple', () => {
        for (let i = 0; i < 10000; i++) {
            const item = new MarshalSuperSimple(i, 'name' + i);
            classToPlain(MarshalSuperSimple, item);
        }
    });

    bench('ClassTransformer: 10000x classToPlain SuperSimple', () => {
        for (let i = 0; i < 10000; i++) {
            const item = new ClassTransformerSuperSimple;
            item.id = i;
            item.name = 'name' + i;

            classTransformerClassToPlain(item);
        }
    });
});
