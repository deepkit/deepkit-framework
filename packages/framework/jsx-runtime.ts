/// <reference path="./src/template/elements.d.ts" />

import {Attributes, Element} from './src/template/template';
import './src/template/optimize-tsx';

export function jsx(element: Element, attributes?: Attributes | string | null) {
    return {render: element, attributes};
}

export function jsxs(element: Element, attributes?: Attributes | string | null) {
    return {render: element, attributes};
}

export {createElement} from './src/template/template';
