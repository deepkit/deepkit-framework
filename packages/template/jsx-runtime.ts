/// <reference path="./src/elements.d.ts" />

import { Attributes, createElement, Element, html } from './src/template';
import './src/optimize-tsx';

export {createElement, html} from './src/template';

export function jsx(element: Element, attributes?: Attributes | string | null) {
    return {render: element, attributes};
}

export function jsxs(element: Element, attributes?: Attributes | string | null) {
    return {render: element, attributes};
}

jsx.createElement = createElement;
jsx.html = html;
