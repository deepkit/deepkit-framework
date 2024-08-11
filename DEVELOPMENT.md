# Development

## Prerequisites

Deepkit uses NPM and Lerna to manage this monorepo. Local package linking is managed through the NPM Workspaces.

Make sure `libpq5` and `libpq-dev` are installed. 
These are needed for Postgres client `pg`, which is used in `@deepkit/postgres`.\
See [Ubuntu requirements setup](docs/setup-env-ubuntu.md) for detailed steps for an Ubuntu system.

Node >= v20 is needed.

## Getting Started

```shell
git clone https://github.com/deepkit/deepkit-framework.git
cd deepkit-framework
yarn
```

Make sure the compiler is built first and injected to node_modules:

```shell
npm run postinstall
```

When installation is finished you can build the packages:

```shell
deepkit-framework » npm run build
```

This could take several minutes.
You should see the build messages and a _success_ summary in the end:

```shell
> build
> build
> tsc --build tsconfig.json && tsc --build tsconfig.esm.json && lerna run build

lerna notice cli v7.4.1

    ✔  @deepkit/core:build (320ms)
    ✔  @deepkit/topsort:build (324ms)
    ✔  @deepkit/type-spec:build (324ms)
    ✔  @deepkit/core-rxjs:build (326ms)
    ✔  @deepkit/filesystem:build (326ms)
    ...
    ✔  @deepkit/api-console-gui:build (19s)
    ✔  @deepkit/api-console-module:build (297ms)
    ✔  @deepkit/orm-browser-gui:build (21s)
    ✔  @deepkit/framework-debug-gui:build (29s)
    ✔  @deepkit/orm-browser:build (295ms)

 ——————————————————————————————————————————————

 >  Lerna (powered by Nx)   Successfully ran target build for 43 projects (1m)
```

You can try running some tests

```shell
npm run test packages/type/
```

If everything went fine you can try out the example app:

```shell
deepkit-framework » cd packages/example-app
deepkit-framework/packages/example-app » npm run app
```

That should give you a _usage_ message of the app.

To start the app server:

```shell
deepkit-framework/packages/example-app » npm run start
```

```shell
...
2023-01-05T23:22:02.199Z [LOG] HTTP listening at http://0.0.0.0:8080
2023-01-05T23:22:02.199Z [LOG] Debugger enabled at http://0.0.0.0:8080/_debug/
2023-01-05T23:22:02.199Z [LOG] Server started.
```


## Making changes 

In order to make sure that all packages are built correctly and that Jest understands cross-package references you
should run the included build watcher commands during local development. Usually it's enough to run the `tsc-watch`,
but when ESM packages are consumed for example by our Angular apps, you need to run `tsc-watch:esm` as well.

```shell
deepkit-framework » npm run tsc-watch
deepkit-framework » npm run tsc-watch:esm
```

## Using deepkit-framework checkout with own project

This describes one way how to use a development version (git checkout) or your own fork of deepkit-framework with your
own project.

Add `npm-local-development` package to your project:

```shell
my-project » npm i npm-local-development --save-dev
```

Put a `.links.json` file in your project (not deepkit-framework):

```json
{
"@deepkit/core": "../deepkit-framework/packages/core",
"@deepkit/bson": "../deepkit-framework/packages/bson",
"@deepkit/type": "../deepkit-framework/packages/type",
"@deepkit/mongo": "../deepkit-framework/packages/mongo",
"@deepkit/type-compiler": "../deepkit-framework/packages/type-compiler",
"@deepkit/sql": "../deepkit-framework/packages/sql",
"@deepkit/injector": "../deepkit-framework/packages/injector",
"@deepkit/rpc": "../deepkit-framework/packages/rpc",
"@deepkit/http": "../deepkit-framework/packages/http",
"@deepkit/event": "../deepkit-framework/packages/event",
"@deepkit/logger": "../deepkit-framework/packages/logger",
"@deepkit/framework": "../deepkit-framework/packages/framework",
"@deepkit/app": "../deepkit-framework/packages/app",
"@deepkit/postgres": "../deepkit-framework/packages/postgres",
"@deepkit/sqlite": "../deepkit-framework/packages/sqlite",
"@deepkit/orm": "../deepkit-framework/packages/orm"
}
```

Adapt the path of `../deepkit-framework` to the checkout path of your deepkit-framework.

In your project's `package.json` add a script:

```json
{
    "scripts": {
        "link": "npm-local-development ."
    }
}
```

Run

```shell
my-project » npm run link
```

Whenever you updated some packages in your project run `npm run link`.
