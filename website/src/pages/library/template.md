---
title: Deepkit Template
package: "@deepkit/template"
doc: template
api: template
category: template
---

<p class="introduction">
    Deepkit Template is a JSX based template engine to generate HTML or XML format.
</p>

## Features

<div class="app-boxes-small">
    <box title="Typesafe">Typesafe components.</box>
    <box title="Async">Async components.</box>
    <box title="Dependency Injection">Dependency Injection.</box>
    <box title="High Performance">High Performance.</box>
    
</div>

<feature>

## Templates

JSX allows you to write HTML, or any other XML based format in a typesafe way. It is a superset of JavaScript and thus allows you to use all JavaScript features.

```tsx
export function MyComponent(props: { title: string }) {
    return <div>Hello {props.title}</div>;
}

router.get('/hello/:text', (text: string) => {
    return <MyComponent title={text}/>;
});

//GET /hello/world => <div>Hello world</div>
```

</feature>

<feature class="center">

## High Performance

All JSX components are compiled to native JavaScript code at runtime. This allows to execute templates with the same performance as native JavaScript code.

```tsx
// original TypeScript TSX
export function MyComponent(props: {title: string}) {
    return <div>Hello {props.title}</div>;
}
```

```javascript
// is optimised at runtime
export function MyComponent(props) {
    return '<div>Hello ' + escape(props.title) + '</div>';
}
```

</feature>



<feature class="right">

## Async Components

Components can be async. This allows you to load data from a file, database, or remote API and render the component once the data is available.


```tsx
export async function MyComponent(props: { title: string }) {
    const data = await fetch('https://example.com/data');
    return <div>Hello {props.title} {data}</div>;
}
```

</feature>



<feature>

## Dependency Injection

Deepkit Template supports dependency injection. This allows you to inject services into your components.

```tsx
export async function User(
    props: { id: number }, 
    database: Database,
) {
    const user = await database.query(User)
        .filter({ id: props.id })
        .findOne();

    return <div>Hello {user.name}</div>;
}

router.get('/user/:id', (id: number) => {
    return <User id={id}/>;
});
```

</feature>
