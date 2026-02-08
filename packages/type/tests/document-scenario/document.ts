import { uuid } from '../../src/utils.js';

type MongoId = string & { __mongoId?: true };
type Primary = { __primary?: true };

class Collection<T> {
    constructor(private readonly pages: T[] = []) {}

    public get(index: number): T | null {
        return this.pages[index] || null;
    }

    public count(): number {
        return this.pages.length;
    }
}

export class Document {
    _id?: MongoId & Primary;

    name?: string;

    pages: Collection<Page> = new Collection();

    page?: Page;
}

export class Page {
    id: string = uuid();

    children: Collection<Page> = new Collection();

    picture?: ArrayBuffer;

    parent?: Page;

    constructor(public readonly name: string) {}
}
