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

import {ClassType, isClass} from '@deepkit/core';
import {Injector} from '../injector/injector';
import {isArray} from '@deepkit/type';
import './optimize-tsx';

export type Attributes<T = any> = {
    [P in keyof T]: T[P];
} & {children?: (ElementStruct | string)[] | ElementStruct | string};

export abstract class ElementClass {
    constructor(protected attributes: Attributes) {
    }

    abstract render(): Element;
}

export interface ElementFn {
    (attributes: Attributes, children: string[]): Element;
}

export type Element = string | ElementFn | ClassType<ElementClass> | Element[];

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

export type ElementStruct = { render: string | ElementFn, attributes: Attributes | null | string, children: (ElementStruct | string | ElementStruct[])[] };

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

    let children = '';
    if (struct.children) {
        if (isArray(struct.children)) {
            children = await renderChildren(injector, struct.children);
        } else {
            children = await renderChildren(injector, [struct.children]);
        }
    } else if (struct.attributes && 'string' !== typeof struct.attributes && struct.attributes?.children) {
        if (isArray(struct.attributes.children)) {
            children = await renderChildren(injector, struct.attributes.children);
        } else {
            children = await renderChildren(injector, [struct.attributes.children]);
        }
    }
    //this is 3x faster than contents.join('')
    // for (const content of struct.contents) {

    if ('string' === typeof struct.render) {
        const tag = struct.render;
        let res = '<' + tag;
        if (struct.attributes === null) {
        } else if ('string' === typeof struct.attributes) {
            res += ' ' + struct.attributes;
        } else {
            for (const i in struct.attributes) {
                if (i === 'children') continue;
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

export function createElement(element: Element, attributes?: Attributes | null, ...children: (string | ElementStruct)[]) {
    return {render: element, attributes, children};
}

export const template = {createElement: createElement};
