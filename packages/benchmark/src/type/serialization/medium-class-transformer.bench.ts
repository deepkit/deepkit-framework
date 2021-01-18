/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import 'reflect-metadata';
import { classToPlain, Exclude as ctExclude, plainToClass, Transform, Type } from 'class-transformer';
import { BenchSuite } from '../../bench';

export class SubModel {
    label: string;

    age?: number;

    constructorUsed = false;

    constructor(label: string) {
        this.label = label;
        this.constructorUsed = true;
    }
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

export class Model {
    name?: string;
    type: number = 0;
    yesNo: boolean = false;

    @Transform(v => Plan[v])
    plan: Plan = Plan.DEFAULT;

    @Type(() => Date)
    created: Date = new Date;

    types: string[] = [];

    @Type(() => SubModel)
    children: SubModel[] = [];

    @Type(() => SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    @ctExclude()
    notMapped: { [key: string]: any } = {};

    anyField: any;

    @ctExclude()
    excluded: string = 'default';

    @ctExclude({ toPlainOnly: true })
    excludedForPlain: string = 'excludedForPlain';
}

export async function main() {
    const suite = new BenchSuite('class-transformer');
    const plain = {
        name: 'name',
        type: 2,
        plan: Plan.ENTERPRISE,
        children: [{ label: 'label' }],
        childrenMap: { 'sub': { label: 'label' } },
        types: ['a', 'b', 'c']
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
