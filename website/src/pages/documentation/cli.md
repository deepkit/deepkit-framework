# CLI

Command-line Interface (CLI) programs are programs that interact via the terminal in the form of text input and text output. The advantage of interacting with the application in this variant is that only a terminal must exist either locally or via an SSH connection.

A CLI application in Deepkit has full access to the DI container and can thus access all providers and configuration options.

The arguments and options of the CLI application are controlled by method parameters via TypeScript types and are automatically serialized and validated.

CLI is one of three entry points to a Deepkit Framework application. In the Deepkit framework, the application is always launched via a CLI program, which is itself written in TypeScript by the user. Therefore, there is no Deepkit specific global CLI tool to launch a Deepkit application. This is how you launch the HTTP/RPC server, perform migrations, or run your own commands. This is all done through the same entry point, the same file. Once the Deepkit framework is used by importing `FrameworkModule` from `@deepkit/framework`, the application gets additional commands for the application server, migrations, and more.

The CLI framework allows you to easily register your own commands and is based on simple classes. In fact, it is based on `@deepkit/app`, a small package intended only for this purpose, which can also be used standalone without the deepkit framework. In this package you can find decorators that are needed to decorate the CLI controller class.

Controllers are managed or instantiated by the Dependency Injection container and can therefore use other providers. See the [Dependency Injection](dependency-injection.md#) chapter for more details.
