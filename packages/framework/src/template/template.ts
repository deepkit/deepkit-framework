import './elements';
import {ClassType, isClass} from '@deepkit/core';
import {Injector} from '../injector/injector';
import {addHook} from 'pirates';
import {optimize} from './optimize-tsx';
import {isArray} from '@deepkit/type';

function transform(code: string, filename: string) {
    if (code.indexOf('template.createElement(') === -1) return code;
    return optimize(code);
}

addHook(transform, {exts: ['.js', '.tsx']});

export type Attributes<T = any> = {
    [P in keyof T]: T[P];
}

export abstract class ElementClass {
    constructor(protected attributes: Attributes) {
    }

    abstract render(): Element;
}

export interface ElementFn {
    (attributes: Attributes, children: string[]): Element;
}

export type Element = undefined | string | ElementFn | ClassType<ElementClass> | Element[];

const voidElements: { [name: string]: true } = {
    area: true,
    base: true,
    br: true,
    col: true,
    command: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true,
};

type ElementStruct = { render: string | ElementFn, attributes: Attributes | null | string, contents: (ElementStruct | string | ElementStruct[])[] };

export function isElementStruct(v: any): v is ElementStruct {
    return 'object' === typeof v && v.hasOwnProperty('render') && v.hasOwnProperty('attributes') && !v.slice;
}

async function renderChildren(injector: Injector, contents: (ElementStruct | string | ElementStruct[])[]): Promise<string> {
    let children = '';
    //this is 3x faster than contents.join('')
    // for (const content of struct.contents) {
    for (const item of contents) {
        if (item === undefined) continue;
        if (isArray(item)) {
            children += await renderChildren(injector, item);
        } else {
            if (item.constructor === Object) {
                children += await render(injector, item);
            } else {
                children += item;
            }
        }
    }

    return children;
}

export async function render(injector: Injector, struct: ElementStruct | string): Promise<any> {
    if ('string' === typeof struct) {
        return struct;
    }

    let children = await renderChildren(injector, struct.contents);
    //this is 3x faster than contents.join('')
    // for (const content of struct.contents) {

    if ('string' === typeof struct.render) {
        const tag = struct.render;
        let res = '<' + tag;
        if (struct.attributes === null) {
        } else if ('string' === typeof struct.attributes) {
            res += struct.attributes;
        } else {
            for (const i in struct.attributes) {
                res += ' ' + i + '="' + struct.attributes[i] + '"';
            }
        }
        if (voidElements[tag]) {
            res += '/>';
        } else {
            res += '>' + children + '</' + tag + '>';
        }
        return res;
    }

    if (isClass(struct.render)) {
        const element = struct.render;
        const args = [struct.attributes || {}, children];
        const types = Reflect.getMetadata('design:paramtypes', element);
        if (types) {
            for (let i = 2; i < types.length; i++) {
                args.push(injector.get(types[i]));
            }
        }
        const instance = new element(...args);
        return await render(injector, await instance.render(struct.attributes || {}, children));
    }

    if ('function' === typeof struct.render) {
        const res = await struct.render(struct.attributes as any || {}, [children]);
        if (isElementStruct(res)) {
            return await render(injector, res);
        } else {
            return res + '';
        }
    }

    return '';
}

export function createElement(element: Element, attributes?: Attributes | null, ...contents: (string | ElementStruct)[]) {
    return {render: element, attributes, contents};
}

export const template = {createElement: createElement};
