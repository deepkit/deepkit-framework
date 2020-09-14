import {t} from '@deepkit/marshal';
import {BenchSuite} from '@deepkit/core';
import {buildChanges, getInstanceState, getJITConverterForSnapshot} from '@deepkit/marshal-orm';

export async function main() {
    const schema = t.schema({
        id: t.primary.number,
        name: t.string,
        priority: t.number,
        tags: t.array(t.string),
        ready: t.boolean
    });

    const item = schema.create({id: 0, name: 'Peter', priority: 4, tags: ['a', 'b', 'c'], ready: true});

    const bench = new BenchSuite('change-detection');
    const createSnapshot = getJITConverterForSnapshot(schema);

    bench.add('create-snapshot', () => {
        const bla = createSnapshot(item);
    });

    getInstanceState(item).markAsPersisted();
    item.name = 'Alex';
    item.tags = ['a', 'b', 'c'];
    bench.add('build-changeSet', () => {
        buildChanges(item);
    });

    bench.run();
}