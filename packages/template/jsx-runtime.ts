/// <reference path="./src/elements.d.ts" />

import { Attributes, createElement, Element, html } from './src/template';
import { escape, escapeAttribute } from './src/utils';
import './src/optimize-tsx';

export { createElement, html } from './src/template';
export { escape, escapeAttribute } from './src/utils';

export function jsx(element: Element, attributes?: Attributes | string | null) {
    return { render: element, attributes };
}

export function jsxs(element: Element, attributes?: Attributes | string | null) {
    return { render: element, attributes };
}

jsx.createElement = createElement;
jsx.html = html;
jsx.escape = escape;
jsx.escapeAttribute = escapeAttribute;
