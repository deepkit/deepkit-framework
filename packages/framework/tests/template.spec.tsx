import 'jest';
import 'reflect-metadata';
import '../src/template/optimize-tsx';
import {render} from '../src/template/template';
import {Injector} from '../src/injector/injector';
import {simple1, simple2, simple3, simple4} from './templates/simple';
import {convertJsxCodeToCreateElement, optimize} from '../src/template/optimize-tsx';

test('template simple', async () => {
    expect(await render(new Injector(), <div></div>)).toBe('<div></div>');

    expect(await render(new Injector(), <div>Test</div>)).toBe('<div>Test</div>');
    expect(await render(new Injector(), <div id="12"></div>)).toBe(`<div id="12"></div>`);
    expect(await render(new Injector(), <div id="12">Test</div>)).toBe(`<div id="12">Test</div>`);

    expect(await render(new Injector(), <div><a href="google.de">Link</a></div>)).toBe('<div><a href="google.de">Link</a></div>');

    expect(await render(new Injector(), <div><b>Link2</b><strong>Link2</strong></div>)).toBe('<div><b>Link2</b><strong>Link2</strong></div>');
});

function normalize(string: string): string {
    return string.trim().replace(/\n\s*/g, '');
}

function Website() {
    return <html><body style="display: flex; justify-content: center"></body></html>
}

test('template jsx convert to createElement', async () => {
    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123",name: "Peter"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { children: "Test" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(
        `jsx_runtime_1.jsxs("div", Object.assign({ id: "123" }, { children: [jsx_runtime_1.jsx("b", { children: "strong" }, void 0), jsx_runtime_1.jsx("b", { children: "strong2" }, void 0)] }), void 0);`
    ))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"}, jsx_runtime_1.createElement("b", {}, "strong"), jsx_runtime_1.createElement("b", {}, "strong2"));`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"});`
    );
});

test('template jsx optimize', async () => {
    expect(normalize(optimize(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `"<div id=\\"123\\"></div>";`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `"<div id=\\"123\\" name=\\"Peter\\"></div>";`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsx("div", { children: "Test" }, void 0);`))).toBe(
        `"<div>Test</div>";`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `"<div id=\\"123\\">Test</div>";`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsxs("div", Object.assign({ id: "123" }, { children: [jsx_runtime_1.jsx("b", { children: "strong" }, void 0), jsx_runtime_1.jsx("b", { children: "strong2" }, void 0)] }), void 0);`))).toBe(
        `"<div id=\\"123\\"><b>strong</b><b>strong2</b></div>";`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(optimize(`jsx_runtime_1.jsx(Website, { title: "Contact", children: jsx_runtime_1.jsx("div", { id: "123" }, void 0)}, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"}, "<div id=\\"123\\"></div>");`
    );
});

test('template simple import', async () => {
    expect(await render(new Injector(), simple1())).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), simple2())).toBe('<div id="123"><b>strong</b></div>');
    expect(await render(new Injector(), simple3())).toBe('<div id="123"><b>strong</b><b>strong2</b></div>');
    expect(await render(new Injector(), simple4())).toBe('<div id="123" class="active"><div><b>strong</b><b>strong2</b></div></div>');
});
