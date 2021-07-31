import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import '../src/optimize-tsx';
import { html, isElementStruct, render } from '../src/template';
import { Injector } from '@deepkit/injector';
import { simple1, simple2, simple3, simple4, simpleHtmlInjected, simpleHtmlInjectedValid } from './simple';
import { convertJsxCodeToCreateElement, optimizeJSX, parseCode } from '../src/optimize-tsx';

Error.stackTraceLimit = 200;

test('template simple', async () => {
    expect(await render(new Injector(), <div></div>)).toBe('<div></div>');

    expect(await render(new Injector(), <div>Test</div>)).toBe('<div>Test</div>');
    expect(await render(new Injector(), <div id="12"></div>)).toBe(`<div id="12"></div>`);
    expect(await render(new Injector(), <div id="12">Test</div>)).toBe(`<div id="12">Test</div>`);

    expect(await render(new Injector(), <div><a href="google.de">Link</a></div>)).toBe('<div><a href="google.de">Link</a></div>');

    expect(await render(new Injector(), <div><b>Link2</b><strong>Link2</strong></div>)).toBe('<div><b>Link2</b><strong>Link2</strong></div>');
});

test('template html escape', async () => {
    expect(await render(new Injector(), <div>{'<strong>MyHTML</strong>'}</div>)).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');

    const myVar = '<strong>MyHTML</strong>';
    expect(await render(new Injector(), <div>{myVar}</div>)).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');

    expect(await render(new Injector(), <div>{html(myVar)}</div>)).toBe('<div><strong>MyHTML</strong></div>');

    expect(await render(new Injector(), <div id={myVar}></div>)).toBe('<div id="<strong>MyHTML</strong>"></div>');
});

function normalize(string: string): string {
    return string.trim().replace(/\n\s*/g, '');
}

function optimiseFn(fn: Function): Function {
    const code = fn.toString();
    return eval('(' + optimizeJSX(code) + ')');
}

async function simpleRender(t: any): Promise<string> {
    return await render(new Injector(), t);
}

// function test1(props: {[name: string]: any} = {}) {
//     return <div {...props} id="123">Test</div>
// }

test('template test', async () => {
    // console.dir(parseCode(`'a' + props.children + 'b'`), { depth: null });
    console.dir(parseCode(`'a' + this.children + 'b'`), { depth: null });
    // console.dir(parseCode(`'a' + children + 'b'`), { depth: null });
    // console.dir(parseCode(`const a = {a: b}`), { depth: null });
    // console.dir(generateCode({ type: 'Identifier', name: 'assd'}), { depth: null });
    // console.dir(generateCode({ type: 'ArrayPattern', elements: [{ type: 'Identifier', name: 'a'}, { type: 'Identifier', name: 'b'}]}), { depth: null });
    // console.dir(parseCode(`html('asd')`), { depth: null });
    // console.dir(parseCode(`html(\`asd\`)`), { depth: null });
    // console.dir(parseCode(`html(\`asd \${3} \`)`), { depth: null });
    // console.dir(parseCode(`variable + '23' + 23;`), { depth: null });
    // console.log(test1.toString());
    // console.log(JSON.stringify(tree.parse('_jsx.createElement("div", {}, void 0)')));
});


test('template jsx for esm convert to createElement', async () => {
    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: "123" }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: myId }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: myId});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123",name: "Peter"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { children: "Test" }, void 0);`))).toBe(
        `_jsx.createElement("div", {}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123"}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(
        `_jsxs("div", Object.assign({ id: "123" }, { children: [_jsx("b", { children: "strong" }, void 0), _jsx("b", { children: "strong2" }, void 0)] }), void 0);`
    ))).toBe(
        `_jsx.createElement("div", {id: "123"}, _jsx.createElement("b", {}, "strong"), _jsx.createElement("b", {}, "strong2"));`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx('div', {children: this.config.get('TEST') }, void 0);`))).toBe(
        `_jsx.createElement("div", {}, this.config.get("TEST"));`
    );
});

test('template jsx for esm optimize', async () => {
    expect(normalize(optimizeJSX(`_jsx("div", { id: "123" }, void 0);`))).toBe(
        `"<div id=\\"123\\"></div>";`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { id: myId }, void 0);`))).toBe(
        `"<div id=\\\"" + _jsx.escapeAttribute(myId) + "\\\"></div>";`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `"<div id=\\"123\\" name=\\"Peter\\"></div>";`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { children: "Test" }, void 0);`))).toBe(
        `"<div>Test</div>";`
    );

    expect(normalize(optimizeJSX(`_jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `"<div id=\\"123\\">Test</div>";`
    );

    expect(normalize(optimizeJSX(`_jsx("div", Object.assign({}, props, { id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `_jsx.createElement("div", Object.assign({}, props, {id: "123"}), "Test");`
    );

    expect(normalize(optimizeJSX(`_jsxs("div", Object.assign({ id: "123" }, { children: [_jsx("b", { children: "strong" }, void 0), _jsx("b", { children: "strong2" }, void 0)] }), void 0);`))).toBe(
        `"<div id=\\"123\\"><b>strong</b><b>strong2</b></div>";`
    );

    expect(normalize(optimizeJSX(`_jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(optimizeJSX(`_jsx(Website, { title: "Contact", children: _jsx("div", { id: "123" }, void 0)}, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"}, _jsx.html("<div id=\\"123\\"></div>"));`
    );
});


test('template jsx for cjs convert to createElement', async () => {
    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: myId }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: myId});`
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

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx('div', {children: this.config.get('TEST') }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {}, this.config.get("TEST"));`
    );
});

test('template jsx for cjs optimize', async () => {
    <div id="123"></div>;
    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `"<div id=\\"123\\"></div>";`
    );

    <div><span>1</span><span>2</span></div>;
    expect(normalize(optimizeJSX(`jsx_runtime_1.jsxs("div", { children: [jsx_runtime_1.jsx("span", { children: "1" }, void 0), jsx_runtime_1.jsx("span", { children: "2" }, void 0)] }, void 0);`))).toBe(
        `"<div><span>1</span><span>2</span></div>";`
    );

    const hi = '123';
    <div>{hi}</div>;
    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { children: hi }, void 0);`))).toBe(
        `"<div>" + jsx_runtime_1.escape(hi) + "</div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: myId }, void 0);`))).toBe(
        `"<div id=\\\"" + jsx_runtime_1.escapeAttribute(myId) + "\\\"></div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: hi }), void 0)`))).toBe(
        `"<div id=\\\"123\\\">" + jsx_runtime_1.escape(hi) + "</div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `"<div id=\\"123\\" name=\\"Peter\\"></div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { children: "Test" }, void 0);`))).toBe(
        `"<div>Test</div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `"<div id=\\"123\\">Test</div>";`
    );

    //for spread operator we have `props` in Object.assign
    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", Object.assign({}, props, { id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", Object.assign({}, props, {id: "123"}), "Test");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsxs("div", Object.assign({ id: "123" }, { children: [jsx_runtime_1.jsx("b", { children: "strong" }, void 0), jsx_runtime_1.jsx("b", { children: "strong2" }, void 0)] }), void 0);`))).toBe(
        `"<div id=\\"123\\"><b>strong</b><b>strong2</b></div>";`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx(Website, { title: "Contact", children: jsx_runtime_1.jsx("div", { id: "123" }, void 0)}, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"}, jsx_runtime_1.html("<div id=\\"123\\"></div>"));`
    );
});

test('template simple import', async () => {
    expect(await render(new Injector(), simple1())).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), simple2())).toBe('<div id="123"><b>strong</b></div>');
    expect(await render(new Injector(), simple3())).toBe('<div id="123"><b>strong</b><b>strong2</b></div>');
    expect(await render(new Injector(), simple4())).toBe('<div id="123" class="active"><div><b>strong</b><b>strong2</b></div></div>');
    expect(await render(new Injector(), simpleHtmlInjected())).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');
    expect(await render(new Injector(), simpleHtmlInjectedValid())).toBe('<div><strong>MyHTML</strong></div>');
});


test('async function', async () => {
    async function Test() {
        return <span>yes</span>;
    }

    const t = <div><Test/></div>;
    const code = `jsx_runtime_1.jsx("div", { children: jsx_runtime_1.jsx(Test, {}, void 0) }, void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `({render: undefined,attributes: undefined,childrenEscaped: ["<div>", jsx_runtime_1.createElement(Test, {}), "</div>"]});`
    );
    expect(await render(new Injector(), t)).toBe('<div><span>yes</span></div>');
});

test('async function', async () => {
    expect(isElementStruct({ render: undefined, children: [], attributes: undefined })).toBe(true);
});

test('fragment', async () => {
    expect(await render(new Injector(), <>
        hi
    </>)).toBe('hi');

    expect(await render(new Injector(), <>
        <div>hi</div>
    </>)).toBe('<div>hi</div>');
});

test('fragment optimizes', async () => {
    {
        const t = <>
            <span>1</span>
            <span>2</span>
        </>;
        //t compiles down to this jsx code:
        const code = `jsx_runtime_1.jsxs(jsx_runtime_1.Fragment, { children: [jsx_runtime_1.jsx("span", { children: "1" }, void 0), jsx_runtime_1.jsx("span", { children: "2" }, void 0)] }, void 0)`;
        expect(normalize(optimizeJSX(code))).toBe(
            `"<span>1</span><span>2</span>";`
        );
        expect(await render(new Injector(), t)).toBe('<span>1</span><span>2</span>');
    }

    {
        const hi = 'peter';
        const t = <>
            <div id="123">{hi}</div>
            <span>2</span>
        </>;
        //t compiles down to this jsx code:
        const code = `jsx_runtime_1.jsxs(jsx_runtime_1.Fragment, { children: [jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: hi }), void 0), jsx_runtime_1.jsx("span", {}, void 0)] }, void 0)`;
        expect(normalize(optimizeJSX(code))).toBe(
            `"<div id=\\\"123\\\">" + jsx_runtime_1.escape(hi) + "</div><span></span>";`
        );
        expect(await render(new Injector(), t)).toBe('<div id="123">peter</div><span>2</span>');
    }

    {
        const t = <div>
            hi
            <>
                empty
            </>
        </div>;
        //t compiles down to this jsx code:
        const code = `jsx_runtime_1.jsxs("div", { children: ["hi", jsx_runtime_1.jsx(jsx_runtime_1.Fragment, { children: "empty" }, void 0)] }, void 0)`;
        expect(normalize(optimizeJSX(code))).toBe(
            `"<div>hiempty</div>";`
        );
        expect(await render(new Injector(), t)).toBe('<div>hiempty</div>');
    }
});

test('doctype', async () => {
    const page = await render(new Injector(), <>
        {html(`<!DOCTYPE html>`)}
        <html>
        <title>Page</title>
        </html>
    </>);

    expect(page).toBe('<!DOCTYPE html><html><title>Page</title></html>');
});

test('website 1', async () => {
    const t = <>
        {html('<!DOCTYPE html>')}
        <html lang="en">
        <head>
            <meta charset="utf-8"/>
            <title>Website</title>
        </head>
        <body>
        </body>
        </html>
    </>;

    //t compiles down to this jsx code:
    const code = `jsx_runtime_1.jsxs(jsx_runtime_1.Fragment, { children: [template_1.html(\`<!DOCTYPE html>\`), jsx_runtime_1.jsxs("html", Object.assign({ lang: "en" }, { children: [jsx_runtime_1.jsxs("head", { children: [jsx_runtime_1.jsx("meta", { charset: "utf-8" }, void 0), jsx_runtime_1.jsx("title", { children: "Website" }, void 0)] }, void 0), jsx_runtime_1.jsx("body", {}, void 0)] }), void 0)] }, void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `"<!DOCTYPE html><html lang=\\\"en\\\"><head><meta charset=\\\"utf-8\\\"></meta><title>Website</title></head><body></body></html>";`
    );
    expect(await render(new Injector(), t)).toBe('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Website</title></head><body></body></html>');
});

test('website 2', async () => {
    const page = 'Hello World';
    const t = <title>{page}</title>;
    const code = `jsx_runtime_1.jsx("title", { children: page }, void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `"<title>" + jsx_runtime_1.escape(page) + "</title>";`
    );
    expect(await render(new Injector(), t)).toBe('<title>Hello World</title>');
});

test('website 2.2', async () => {
    const page = 'Hello World';
    const t = <title id="2">{page}</title>;
    const code = `jsx_runtime_1.jsx("title", Object.assign({ id: "2" }, { children: page }), void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `"<title id=\\\"2\\\">" + jsx_runtime_1.escape(page) + "</title>";`
    );
    expect(await render(new Injector(), t)).toBe('<title id="2">Hello World</title>');
});

test('website 3', async () => {
    const page = 'Hello World';
    const t = <head id="2"><title>{page}</title></head>;
    const code = `jsx_runtime_1.jsx("head", Object.assign({ id: "2" }, { children: jsx_runtime_1.jsx("title", { children: page }, void 0) }), void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `"<head id=\\\"2\\\"><title>" + jsx_runtime_1.escape(page) + "</title></head>";`
    );
    expect(await render(new Injector(), t)).toBe('<head id="2"><title>Hello World</title></head>');
});

test('website 4', async () => {
    const page = 'Hello World';

    const t = <>
        {html(`<!DOCTYPE html>`)}
        <html lang="en">
        <head>
            <meta charset="utf-8"/>
            <title>{page}</title>
        </head>
        <body>
        </body>
        </html>
    </>;

    //t compiles down to this jsx code:
    const code = `jsx_runtime_1.jsxs(jsx_runtime_1.Fragment, { children: [template_1.html(\`<!DOCTYPE html>\`), jsx_runtime_1.jsxs("html", Object.assign({ lang: "en" }, { children: [jsx_runtime_1.jsxs("head", { children: [jsx_runtime_1.jsx("meta", { charset: "utf-8" }, void 0), jsx_runtime_1.jsx("title", { children: page }, void 0)] }, void 0), jsx_runtime_1.jsx("body", {}, void 0)] }), void 0)] }, void 0)`;
    expect(normalize(optimizeJSX(code))).toBe(
        `"<!DOCTYPE html><html lang=\\\"en\\\"><head><meta charset=\\\"utf-8\\\"></meta><title>" + jsx_runtime_1.escape(page) + "</title></head><body></body></html>";`
    );
    expect(await render(new Injector(), t)).toBe('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Hello World</title></head><body></body></html>');
});

test('template render custom', async () => {
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: 'Test' })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: '<b>Test</b>' })).toBe('<div id="123">&lt;b&gt;Test&lt;/b&gt;</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: html('Test') })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: [html('Test')] })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: [html('<b>Test</b>')] })).toBe('<div id="123"><b>Test</b></div>');

    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: ['Hi ', html('Test')] })).toBe('<div id="123">Hi Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: '', children: ['Hi ', html('Test')] })).toBe('<div>Hi Test</div>');

    expect(await render(new Injector(), {
        render: 'div',
        attributes: '',
        children: ['Hi ', { render: 'div', attributes: '', children: html('Test') }]
    })).toBe('<div>Hi <div>Test</div></div>');

});

test('html is still sanitized in compiled templates', async () => {
    function test1() {
        const content = '<span>unsafe</span>';
        return <div>{content}</div>;
    }

    function test2() {
        const content = '<span>unsafe</span>';
        return <div>{html(content)}</div>;
    }

    // console.log(test1.toString());
    // console.log(optimiseFn(test1).toString());
    // console.log(optimiseFn(test1)());
    expect(await simpleRender(test1())).toBe('<div>&lt;span&gt;unsafe&lt;/span&gt;</div>');
    expect(await simpleRender(optimiseFn(test1)())).toBe('<div>&lt;span&gt;unsafe&lt;/span&gt;</div>');

    expect(await simpleRender(test2())).toBe('<div><span>unsafe</span></div>');
    // console.log(test2.toString());
    // console.log(optimiseFn(test2).toString());
    // console.log(optimiseFn(test2)());
    expect(await simpleRender(optimiseFn(test2)())).toBe('<div><span>unsafe</span></div>');
});

test('attribute is still sanitized in compiled templates', async () => {
    function test1() {
        const content = `<span id="3">unsafe</span>`;
        return <div id={content}></div>;
    }

    expect(await simpleRender(test1())).toBe('<div id="<span id=\"3\">unsafe</span>"></div>');
    // console.log(optimiseFn(test1).toString());
    // console.log(optimiseFn(test1)());
    expect(await simpleRender(optimiseFn(test1)())).toBe('<div id="<span id=\"3\">unsafe</span>"></div>');
});

test('literals are escaped', async () => {
    function test1() {
        return <div>{'<h1>'}</div>;
    }

    expect(await simpleRender(test1())).toBe('<div>&lt;h1&gt;</div>');
    expect(await simpleRender(optimiseFn(test1)())).toBe('<div>&lt;h1&gt;</div>');
});

test('Vars are escaped', async () => {
    function test1(val: string) {
        return <div>{val}</div>;
    }

    expect(await simpleRender(test1('<h1>'))).toBe('<div>&lt;h1&gt;</div>');
    expect(await simpleRender(optimiseFn(test1)('<h1>'))).toBe('<div>&lt;h1&gt;</div>');
});

test('sub call be unwrapped', async () => {
    function Sub() {
        return <div></div>
    }

    function Comp(props: {children?: any}) {
        return <div><Sub/></div>;
    }

    expect(optimizeJSX(Comp.toString())).toContain(
        `["<div>", jsx_runtime_1.createElement(Sub, {}), "</div>"]`
    )
});

test('children will be unwrapped', async () => {
    function Comp(props: {children?: any}) {
        return <html>
            <div>{props.children}</div>
        </html>;
    }

    console.log(optimizeJSX(Comp.toString()));
    expect(optimizeJSX(Comp.toString())).toContain(
        `["<div>", props.children, "</div>"]`
    )
});


test('component children will be unwrapped', async () => {
    class Comp {
        constructor(protected children: any) {
        }
        render() {
            return <html>
                <div>{this.children}</div>
            </html>
        }
    }

    console.log(optimizeJSX(Comp.toString()));
    expect(optimizeJSX(Comp.toString())).toContain(
        `childrenEscaped: ["<div>", this.children, "</div>"]`
    )
});
