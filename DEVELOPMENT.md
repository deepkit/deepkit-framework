# Development

## Prerequisites
Deepkit uses NPM and Lerna to manage this monorepo. Local package linking is managed through the NPM Workspaces.

Make sure `libpq5` and `libpq-dev` are installed, and `python` refers Python2.

Node >= v18 is needed.

## Getting Started

```shell
git clone https://github.com/deepkit/deepkit-framework.git
cd deepkit-framework
npm install
npm run install-compiler
```

When installation is finished you can build the packages:

```shell
deepkit-framework » npm run build
```

This could take several minutes.
You should see the build messages and a _success_ summary in the end:

```shell
lerna success run Ran npm script 'build' in 36 packages in 83.9s:
lerna success - @deepkit/angular-universal
lerna success - @deepkit/api-console-api
...
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
should run the included build watcher commands during local development

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

Adapt the path to `deepkit-framework` if needed.

In your project's `package.json` add a script:

```json
"scripts: {
    "link": "npm-local-development ."
}
```

Run

```shell
my-project » npm run link
```

Whenever you updated some packages in your project run `npm run link`.
