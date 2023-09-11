/// <reference path="./lib/elements.d.ts" />

import { Attributes, createElement, Element, html } from './lib/template.js';
import { escape, escapeAttribute, safe, safeString } from './lib/utils.js';
import './lib/optimize-tsx';

export { createElement, html } from './lib/template.js';
export { escape, escapeAttribute, safeString, safe } from './lib/utils.js';

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
jsx.safeString = safeString;
jsx.safe = safe;
