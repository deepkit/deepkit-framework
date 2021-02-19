/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import { ClassType, getClassName, isClass } from '@deepkit/core';
import { isArray } from '@deepkit/type';
import './optimize-tsx';
import { BasicInjector } from '@deepkit/injector';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

export type Attributes<T = any> = {
    [P in keyof T]: T[P];
} & { children?: (ElementStruct | string)[] | ElementStruct | string };

export abstract class ElementClass {
    constructor(protected attributes: Attributes) {
    }

    abstract render(): Element;
}

interface HtmlString {
    htmlString: string;
}

/**
 * Tell the template engine to not automatically escape the HTML in the given string.
 * Per default all dynamic values are automatically HTML escaped.
 *
 * This is dangerous: Always validate data that you pass as `string` otherwise this can lead
 * to Cross-Side Scripting attacks.
 */
export function html(string: string | HtmlString) {
    return isHtmlString(string) ? string : { htmlString: string };
}

function isHtmlString(obj: any): obj is HtmlString {
    return 'object' === typeof obj && 'string' === typeof obj.htmlString;
}

export function escapeHtml(html: string): string {
    return 'string' === typeof html ? html.replace(/</g, '&lt;').replace(/>/g, '&gt;') : escapeHtml(String(html));
}

export interface ElementFn {
    (attributes: Attributes, children: HtmlString | string): Element;
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

type ElementStructChildren = HtmlString | ElementStruct | string;

export type ElementStruct = { render: string | ElementFn, attributes: Attributes | null | string, children: ElementStructChildren | ElementStructChildren[] };

export function isElementStruct(v: any): v is ElementStruct {
    return 'object' === typeof v && v.hasOwnProperty('render') && v.hasOwnProperty('attributes') && !v.slice;
}

async function renderChildren(injector: BasicInjector, contents: ElementStructChildren[], stopwatch?: Stopwatch): Promise<string> {
    let children = '';
    //this is 3x faster than contents.join('')
    // for (const content of struct.contents) {
    for (const item of contents) {
        if (item === undefined) continue;
        if (isArray(item)) {
            children += await renderChildren(injector, item, stopwatch);
        } else {
            if (isElementStruct(item)) {
                children += await render(injector, item, stopwatch);
            } else {
                if ((item as any).htmlString) {
                    children += (item as any).htmlString;
                } else {
                    children += escapeHtml(item as string);
                }
            }
        }
    }

    return children;
}

export async function render(injector: BasicInjector, struct: ElementStruct | string, stopwatch?: Stopwatch): Promise<any> {
    if ('string' === typeof struct) {
        return struct;
    }

    let children: string = '';
    if (struct.children) {
        if (isArray(struct.children)) {
            children = await renderChildren(injector, struct.children, stopwatch);
        } else {
            children = await renderChildren(injector, [struct.children], stopwatch);
        }
    } else if (struct.attributes && 'string' !== typeof struct.attributes && struct.attributes?.children) {
        if (isArray(struct.attributes.children)) {
            children = await renderChildren(injector, struct.attributes.children, stopwatch);
        } else {
            children = await renderChildren(injector, [struct.attributes.children], stopwatch);
        }
    }

    if ('string' === typeof struct.render) {
        const tag = struct.render;
        let res = '<' + tag;
        if (struct.attributes === null) {
        } else if ('string' === typeof struct.attributes) {
            if (struct.attributes) {
                res += ' ' + struct.attributes;
            }
        } else {
            for (const i in struct.attributes) {
                if (i === 'children') continue;
                const attributeValue = struct.attributes[i];
                const v = isHtmlString(attributeValue) ? attributeValue.htmlString : escapeHtml(attributeValue);
                res += ' ' + i + '="' + v + '"';
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
        const args = [struct.attributes || {}, html(children)];
        const types = Reflect.getMetadata('design:paramtypes', element);
        if (types) {
            for (let i = 2; i < types.length; i++) {
                args.push(injector.get(types[i]));
            }
        }
        const instance = new element(...args);
        if (stopwatch) {
            const frame = stopwatch.start(getClassName(struct.render), FrameCategory.template);
            try {
                return await render(injector, await instance.render(struct.attributes || {}, html(children)), stopwatch);
            } finally {
                frame.end();
            }
        }
        return await render(injector, await instance.render(struct.attributes || {}, html(children)), stopwatch);
    }

    if ('function' === typeof struct.render) {
        const frame = stopwatch?.start(struct.render.name, FrameCategory.template);

        try {
            const res = await struct.render(struct.attributes as any || {}, html(children));
            if (isElementStruct(res)) {
                return await render(injector, res, stopwatch);
            } else {
                return res + '';
            }
        } finally {
            frame?.end();
        }
    }

    return '';
}

export function createElement(element: Element, attributes?: Attributes | null, ...children: (string | ElementStruct | HtmlString)[]) {
    return { render: element, attributes, children };
}
