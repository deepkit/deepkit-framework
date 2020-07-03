import {forwardRef, f} from "../../src/decorators";
import {PageClass} from "./PageClass";

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
