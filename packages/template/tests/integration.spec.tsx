/** @jsxImportSource ../../../dist/packages/template */
import { describe, expect, test } from '@jest/globals';
import '../src/lib/optimize-tsx';
import { html, render } from '../src/lib/template.js';
import { Injector } from '@deepkit/injector';
import { optimizeJSX } from '../src/lib/optimize-tsx.js';
import { escape, safe } from '../src/lib/utils.js';

Error.stackTraceLimit = 200;

function normalize(string: string): string {
    return string.trim().replace(/\n\s*/g, '');
}

function optimiseFn(fn: Function): Function {
    let code = fn.toString();
    if (!code.startsWith('function ')) code = 'function ' + code;
    try {
        const optimised = optimizeJSX(code);
        try {
            return eval('(' + optimised + ')');
        } catch (error) {
            throw new Error(`Could not run optimised code ${optimised}. error: ${error}`);
        }
    } catch (error: any) {
        if (error && 'string' === typeof error.message && !error.message.includes('Could not run optimised code')) {
            throw new Error(`Could not optimise code ${code}. error: ${error}`);
        }
        throw error;
    }
}

async function simpleRender(t: any): Promise<string> {
    return await render(Injector.from([]), t);
}

const tests: { t: Function, contains?: string, result: string }[] = [
    {
        t() {
            return <div></div>;
        },
        contains: `"<div></div>"`,
        result: '<div></div>'
    },
    {
        t() {
            return <div><h1></h1></div>;
        },
        contains: `"<div><h1></h1></div>"`,
        result: '<div><h1></h1></div>'
    },
    {
        t() {
            return <>
                {html(`<!DOCTYPE html>`)}
                <html lang="en">
                <head>
                </head>
                </html>
            </>;
        },
        contains: `"<!DOCTYPE html><html lang=\\"en\\"><head></head></html>"`,
        result: '<!DOCTYPE html><html lang="en"><head></head></html>'
    },
    {
        t() {
            const page = '<h1>Hello World';
            return <title>{page}</title>;
        },
        contains: `[{[jsx_runtime_1.safeString]: "<title>"}, page, {[jsx_runtime_1.safeString]: "</title>"}]`,
        result: '<title>&lt;h1&gt;Hello World</title>'
    },
    {
        t() {
            const safeTitle = '<h1>Hello World</h1>';
            return <title>{safe(safeTitle)}</title>;
        },
        contains: `"<title>" + safeTitle + "</title>"`,
        result: '<title><h1>Hello World</h1></title>'
    },
    {
        t() {
            const safeTitle2 = '<h1>Hello World</h1>';
            return <title>{html(safeTitle2)}</title>;
        },
        contains: `"<title>" + safeTitle2 + "</title>"`,
        result: '<title><h1>Hello World</h1></title>'
    },
    {
        t() {
            const page = '<h1>Hello World';
            return <title>{escape(page)}</title>;
        },
        contains: `"<title>" + (0, utils_js_1.escape)(page).htmlString + "</title>"`,
        result: '<title>&lt;h1&gt;Hello World</title>'
    },
    {
        t() {
            const page = '<h1>Hello World';
            return <html lang="en"><title>{escape(page)}</title></html>;
        },
        contains: `"<html lang=\\"en\\"><title>" + (0, utils_js_1.escape)(page).htmlString + "</title></html>"`,
        result: '<html lang="en"><title>&lt;h1&gt;Hello World</title></html>'
    },
    {
        t() {
            const page = '<h1>Hello World';
            return <html lang="en"><title>{page}</title></html>;
        },
        contains: `[{[jsx_runtime_1.safeString]: "<html lang=\\"en\\"><title>"}, page, {[jsx_runtime_1.safeString]: "</title></html>"}]`,
        result: '<html lang="en"><title>&lt;h1&gt;Hello World</title></html>'
    },
    {
        t() {
            const page = <body>hi</body>;
            return <html lang="en">{page}</html>;
        },
        // contains: `return "<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<html lang="en"><body>hi</body></html>'
    },
    {
        t() {
            const title = '<h1>hi';
            const page = <body>{title}</body>;
            return <html lang="en">{page}</html>;
        },
        // contains: `return "<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<html lang="en"><body>&lt;h1&gt;hi</body></html>'
    },
    {
        t() {
            const page = '<h1>Hello World';
            return <html lang="en"><title>{safe(page)}</title></html>;
        },
        contains: `"<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<html lang="en"><title><h1>Hello World</title></html>'
    },
    {
        t() {
            class Peter {
                constructor(protected props: {}, protected children: any) {
                }

                render() {
                    return <div>{this.children}</div>;
                }
            }

            const page = '<h1>Hello World';
            return <html lang="en"><Peter><h1>{page}</h1></Peter></html>;
        },
        // contains: `"<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<html lang="en"><div><h1>&lt;h1&gt;Hello World</h1></div></html>'
    },
    {
        t() {
            class Peter {
                constructor(protected props: {}, protected children: any) {
                }

                render() {
                    return <div>{this.children}</div>;
                }
            }

            const page = '<h1>Hello World';
            return <html lang="en"><Peter>{page}</Peter></html>;
        },
        // contains: `"<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<html lang="en"><div>&lt;h1&gt;Hello World</div></html>'
    },
    {
        t() {
            const users: { id: number, username: string }[] = [{ id: 1, username: 'peter1' }, { id: 2, username: 'peter2' }];
            const user = users[0];
            return <tr>
                <td>{user.username}</td>
                <td><img src={'/image/' + user.id}/></td>
            </tr>;
        },
        contains: `[{[jsx_runtime_1.safeString]: "<tr><td>"}, user.username, {[jsx_runtime_1.safeString]: "</td><td><img src=\\""}, jsx_runtime_1.escapeAttribute("/image/" + user.id), {[jsx_runtime_1.safeString]: "\\"/></td></tr>"}]`,
        result: '<tr><td>peter1</td><td><img src="/image/1"/></td></tr>'
    },
    {
        t() {
            const users: { id: number, username: string }[] = [{ id: 1, username: 'peter1' }, { id: 2, username: 'peter2' }];

            return <table class="pretty">
                {users.map(user => <tr>
                    <td><strong>{user.username}</strong></td>
                    <td><img class="user-image" src={'/image/' + user.id}/></td>
                </tr>)}
            </table>;
        },
        // contains: `"<html lang=\\"en\\"><title>" + page + "</title></html>"`,
        result: '<table class="pretty"><tr><td><strong>peter1</strong></td><td><img class="user-image" src="/image/1"/></td></tr><tr><td><strong>peter2</strong></td><td><img class="user-image" src="/image/2"/></td></tr></table>'
    },
];

describe.skip('integration', () => {
    for (const i of tests) {
        test(i.result, async () => {
            if (i.contains !== undefined) {
                expect(normalize(optimiseFn(i.t).toString())).toContain(i.contains);
            }

            expect(await simpleRender(i.t())).toBe(i.result);

            const optimised = optimiseFn(i.t);
            const optimisedOutput = await simpleRender(optimised());
            if (optimisedOutput !== i.result) {
                throw new Error(`Optimised function returned something wrong: ${optimised.toString()}. Expected ${i.result}, but got ${optimisedOutput}.`);
            }
            expect(optimisedOutput).toBe(i.result);
        });
    }
});
