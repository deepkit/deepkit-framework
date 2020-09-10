import {t} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import {getJITConverterForSnapshot} from '@super-hornet/marshal-orm';

const schema = t.schema({
    id: t.primary.number,
    name: t.string,
    priority: t.number,
    tags: t.array(t.string),
    ready: t.boolean
});

const item = schema.create({id: 0, name: 'Peter', priority: 4, tags: ['a', 'b', 'c'], ready: true});

const bench = new BenchSuite('snapshot creation');

const createSnapshot = getJITConverterForSnapshot(schema);

bench.add('createSnapshot', () => {
    const bla = createSnapshot(item);
});

bench.run();