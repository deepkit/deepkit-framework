import {PageClass} from "./PageClass";
import {f, forwardRef} from "@super-hornet/marshal";

export class PageCollection {
    constructor(
        @f.array(forwardRef(() => PageClass)).decorated()
        private readonly pages: PageClass[] = []
    ) {
    }

    public get(index: number): PageClass | null {
        return this.pages[index] || null
    }

    public count(): number {
        return this.pages.length;
    }
}
