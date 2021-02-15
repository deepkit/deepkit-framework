import { html } from '../src/template';

export function simpleOnlyAttributes() {
    return <div id="123"></div>
}

export function simpleOnlyChildren() {
    return <div>Test</div>
}

export function simple1() {
    return <div id="123">Test</div>
}

export function simple2() {
    return <div id="123"><b>strong</b></div>
}

export function simple3() {
    return <div id="123"><b>strong</b><b>strong2</b></div>
}

export function simple4() {
    return <div id="123" class="active"><div><b>strong</b><b>strong2</b></div></div>
}

export function spread() {
    const props = { foo: true, bar: false };
    return <div {...props} key="myKey"><b>TestBold</b>Test</div>
}

function Website(props: any) {
    return <html>
        <header><meta name="title">My Website</meta></header>
        <body><div>{props.children}</div></body>
    </html>
}

export function simple5(name: string) {
    return <Website>
        <h1>Hi</h1>
        <p>How are you, {name}?</p>
    </Website>
}

export function simpleHtmlInjected() {
    const myHtml = '<strong>MyHTML</strong>';
    return <div>{myHtml}</div>
}

export function simpleHtmlInjectedValid() {
    const myHtml = '<strong>MyHTML</strong>';
    return <div>{html(myHtml)}</div>
}
