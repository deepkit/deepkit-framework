import {BenchSuite} from '@deepkit/core';
import {jsonSerializer} from '@deepkit/type';
import {autoserializeAs, autoserializeAsArray, Deserialize, Serialize} from "cerialize";

export class Model {
    @autoserializeAs(Number) id?: number;
    @autoserializeAs(String) public name?: string;

    @autoserializeAs(Boolean) ready?: boolean;

    @autoserializeAsArray(String) tags: string[] = [];

    @autoserializeAs(Number) priority: number = 0;
}

export async function main() {
    const suite = new BenchSuite('cerialize');
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    };

    suite.add('deserialize', () => {
        Deserialize(plain, Model);
    });

    const item = Deserialize(plain, Model);
    suite.add('serialize', () => {
        Serialize(item, Model);
    });

    suite.run();
}
