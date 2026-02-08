/**
 * feat/next benchmark — uses @deepkit/bench BenchSuite API.
 * Run: cd /Users/marc/bude/deepkit-framework && node --expose-gc --import @deepkit/run packages/type/benchmarks/compare-bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

import { deserialize, is, serialize, validate } from '../index.js';
import { deserializeFunction, serializeFunction } from '../src/serializer-facade.js';
import { typeGuard } from '../src/typeguard.js';
import { validateFunction } from '../src/validator.js';

class SmallModel {
    ready?: boolean;
    tags: string[] = [];
    priority: number = 0;
    constructor(
        public id: number,
        public name: string,
    ) {}
}

class SubModel {
    age?: number;
    constructor(public label: string) {}
}

enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

class MediumModel {
    type: number = 0;
    yesNo: boolean = false;
    plan: Plan = Plan.DEFAULT;
    created: Date = new Date();
    types: string[] = [];
    children: SubModel[] = [];
    childrenMap: { [key: string]: SubModel } = {};
    constructor(public name: string) {}
}

interface TextMsg {
    type: 'text';
    content: string;
}
interface ImageMsg {
    type: 'image';
    url: string;
    width: number;
    height: number;
}
interface VideoMsg {
    type: 'video';
    url: string;
    duration: number;
}
interface FileMsg {
    type: 'file';
    url: string;
    filename: string;
    size: number;
}
type Message = TextMsg | ImageMsg | VideoMsg | FileMsg;
interface Conversation {
    id: string;
    participants: string[];
    messages: Message[];
}

const smallPlain = { name: 'name', id: 2, tags: ['a', 'b', 'c'], priority: 5, ready: true };
const mediumPlain = {
    name: 'name',
    type: 2,
    plan: Plan.ENTERPRISE,
    children: [{ label: 'label' }],
    childrenMap: { sub: { label: 'label' } },
    types: ['a', 'b', 'c'],
};
const unionData: Conversation = {
    id: 'conv_123',
    participants: ['user1', 'user2'],
    messages: [
        { type: 'text', content: 'Hello!' },
        { type: 'image', url: 'http://x.com/img.jpg', width: 800, height: 600 },
        { type: 'video', url: 'http://x.com/vid.mp4', duration: 120 },
        { type: 'file', url: 'http://x.com/doc.pdf', filename: 'doc.pdf', size: 1024 },
    ],
};

// Pre-warm JIT for inline API
const smallInstance = deserialize<SmallModel>(smallPlain);
const mediumInstance = deserialize<MediumModel>(mediumPlain);
const unionInstance = deserialize<Conversation>(unionData);
serialize<SmallModel>(smallInstance);
serialize<MediumModel>(mediumInstance);
serialize<Conversation>(unionInstance);

// Pre-resolved functions
const smallDeserialize = deserializeFunction<SmallModel>();
const mediumDeserialize = deserializeFunction<MediumModel>();
const unionDeserialize = deserializeFunction<Conversation>();
const smallSerialize = serializeFunction<SmallModel>();
const mediumSerialize = serializeFunction<MediumModel>();
const unionSerialize = serializeFunction<Conversation>();
const smallValidate = validateFunction<SmallModel>();
const mediumValidate = validateFunction<MediumModel>();
const unionValidate = validateFunction<Conversation>();
const smallIs = typeGuard<SmallModel>();
const mediumIs = typeGuard<MediumModel>();
const unionIs = typeGuard<Conversation>();

const suite = new BenchSuite('type/comparison', 2);

// === Inline API: function<T>(data) — includes ReceiveType overhead ===
suite.add('inline small deserialize', () => {
    deserialize<SmallModel>(smallPlain);
});
suite.add('inline medium deserialize', () => {
    deserialize<MediumModel>(mediumPlain);
});
suite.add('inline union deserialize', () => {
    deserialize<Conversation>(unionData);
});
suite.add('inline small serialize', () => {
    serialize<SmallModel>(smallInstance);
});
suite.add('inline medium serialize', () => {
    serialize<MediumModel>(mediumInstance);
});
suite.add('inline union serialize', () => {
    serialize<Conversation>(unionInstance);
});
suite.add('inline small validate', () => {
    validate<SmallModel>(smallPlain);
});
suite.add('inline medium validate', () => {
    validate<MediumModel>(mediumPlain);
});
suite.add('inline union validate', () => {
    validate<Conversation>(unionData);
});
suite.add('inline small is', () => {
    is<SmallModel>(smallPlain);
});
suite.add('inline medium is', () => {
    is<MediumModel>(mediumPlain);
});
suite.add('inline union is', () => {
    is<Conversation>(unionData);
});

// === Pre-resolved API: const fn = getXFunction<T>(); fn(data) ===
suite.add('fn() small deserialize', () => {
    smallDeserialize(smallPlain);
});
suite.add('fn() medium deserialize', () => {
    mediumDeserialize(mediumPlain);
});
suite.add('fn() union deserialize', () => {
    unionDeserialize(unionData);
});
suite.add('fn() small serialize', () => {
    smallSerialize(smallInstance);
});
suite.add('fn() medium serialize', () => {
    mediumSerialize(mediumInstance);
});
suite.add('fn() union serialize', () => {
    unionSerialize(unionInstance);
});
suite.add('fn() small validate', () => {
    smallValidate(smallPlain);
});
suite.add('fn() medium validate', () => {
    mediumValidate(mediumPlain);
});
suite.add('fn() union validate', () => {
    unionValidate(unionData);
});
suite.add('fn() small is', () => {
    smallIs(smallPlain);
});
suite.add('fn() medium is', () => {
    mediumIs(mediumPlain);
});
suite.add('fn() union is', () => {
    unionIs(unionData);
});

suite.run();
