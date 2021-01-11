import { t } from '../../src/decorators';
import { ClassType } from '@deepkit/core';

export interface CollectionConstructor<T> {
    new(pages?: T[]): Collection<T>;
}

export interface Collection<T> {
    get(index: number): T | null;

    count(): number;
}

export function createCollection<T>(classType: ClassType<T>): CollectionConstructor<T> {
    class Collection {
        constructor(
            @t.array(classType).decorated
            private readonly pages: T[] = []
        ) {
        }

        public get(index: number): T | null {
            return this.pages[index] || null;
        }

        public count(): number {
            return this.pages.length;
        }
    }

    return Collection;
}
