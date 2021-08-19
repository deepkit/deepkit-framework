# Development

## Prerequisites
Deepkit uses NPM and Lerna to manage this monorepo. Local package linking is managed through the [npm-local-development](https://www.npmjs.com/package/npm-local-development) CLI.

> We recommend that for the time being you use NPM v6.x. and lockfile format v1

## Getting Started

```shell
git clone https://github.com/deepkit/deepkit-framework.git
cd deepkit-framework
npm install
npm run bootstrap
npm run link
```

## Making changes
In order to make sure that all packages are built correctly and that Jest understands cross-package references you should run the included build watcher commands during local development

```shell
npm run tsc-watch
npm run tsc-watch:esm
```

## Notes
- When one of the package.json files is modified (adding, removing or updating dependencies) you will need to re-run the `npm bootstrap` and `npm link` commands from above
- Never install NPM dependencies directly inside of any of the packages in the `packages/*` directory.
