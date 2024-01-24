import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImageComponent } from '@app/app/components/image.component';
import { AppImagesComponent } from '@app/app/components/images.component';
import { AppTitle } from '@app/app/components/title';

@Component({
    standalone: true,
    styles: [
        `
            .app-boxes {
                margin-top: 50px;
                grid-gap: 50px;
            }

            .libraries,
            .app-banner .wrapper {
                max-width: 880px;
            }

            .libraries {
                max-width: 950px;
            }

            .library,
            .library:link {
                text-align: left;
                display: block;

                color: white;

                &:hover {
                    text-decoration: none;
                }

                h3 {
                    margin: 0;
                    padding: 0;
                    font-size: 18px;
                    font-style: normal;
                    font-weight: 700;
                    line-height: normal;
                }

                .subline {
                    color: #979797;
                    font-size: 14px;
                    margin-bottom: 10px;
                }

                p {
                    margin: 0;
                    padding: 0;
                    font-size: 14px;
                    line-height: 180%;
                }
            }
        `,
    ],
    imports: [RouterLink, ImageComponent, AppImagesComponent, AppTitle],
    template: `
        <app-title value="Libraries"></app-title>
        <div class="app-content-full">
            <div class="app-banner left">
                <div class="wrapper">
                    <h1>LIBRARIES</h1>

                    <div>
                        <p>
                            A collection of open source TypeScript libraries under MIT license that work standalone or
                            in combination. Each library lives in its own NPM package, is carefully optimised, and
                            follows modern best practises.
                        </p>

                        <p>
                            Progressively adopt Deepkit libraries one by one or use all together in Deepkit Framework.
                        </p>
                    </div>
                </div>
            </div>
            <div class="wrapper libraries">
                <div class="app-boxes">
                    <a routerLink="/library/type" class="app-box hover library">
                        <h3>Runtime Types</h3>
                        <div class="subline">&#64;deepkit/type</div>
                        <p>
                            Runtime TypeScript types with reflection, high-performance serialization and validation, and
                            much more.
                        </p>
                    </a>
                    <a routerLink="/library/app" class="app-box hover library">
                        <h3>Deepkit App</h3>
                        <div class="subline">&#64;deepkit/app</div>
                        <p>
                            A command line interface (CLI) framework for TypeScript with service container, module
                            system, hooks, and easy to define commands.
                        </p>
                    </a>
                    <a routerLink="/library/framework" class="app-box hover library">
                        <h3>Deepkit Framework</h3>
                        <div class="subline">&#64;deepkit/framework</div>
                        <p>
                            A framework that brings together all Deepkit libraries with application server, debugging
                            and profiler tools, and much more.
                        </p>
                    </a>
                    <a routerLink="/library/orm" class="app-box hover library">
                        <h3>Deepkit ORM</h3>
                        <div class="subline">&#64;deepkit/orm</div>
                        <p>
                            High performance TypeScript ORM with Unit Of Work, migrations, and much more. MySQL,
                            PostgreSQL, SQLite, MongoDB.
                        </p>
                    </a>
                    <a routerLink="/library/rpc" class="app-box hover library">
                        <h3>Deepkit RPC</h3>
                        <div class="subline">&#64;deepkit/rpc</div>
                        <p>
                            A end-to-end typesafe and modern high performance Remote Procedure Call (RPC) framework for
                            TypeScript.
                        </p>
                    </a>
                    <a routerLink="/library/http" class="app-box hover library">
                        <h3>Deepkit HTTP</h3>
                        <div class="subline">&#64;deepkit/http</div>
                        <p>
                            A HTTP kernel and router with async controller support based on workflow system and
                            decorators.
                        </p>
                    </a>
                    <a routerLink="/library/injector" class="app-box hover library">
                        <h3>Dependency Injection</h3>
                        <div class="subline">&#64;deepkit/injector</div>
                        <p>The most advanced dependency injection container for TypeScript.</p>
                    </a>
                    <a routerLink="/library/template" class="app-box hover library">
                        <h3>Template</h3>
                        <div class="subline">&#64;deepkit/template</div>
                        <p>
                            Fully typesafe and fast template engine based on JSX, with support for dependency injection
                            and async templates.
                        </p>
                    </a>
                    <a routerLink="/library/broker" class="app-box hover library">
                        <h3>Broker</h3>
                        <div class="subline">&#64;deepkit/broker</div>
                        <p>
                            Typesafe message bus server for pub/sub pattern, key-value storage, and central atomic app
                            locks.
                        </p>
                    </a>
                    <a routerLink="/documentation/app/logger" class="app-box hover library">
                        <h3>Logger</h3>
                        <div class="subline">&#64;deepkit/logger</div>
                        <p>Logger library with support for colors, scopes, various transporter and formatter.</p>
                    </a>
                </div>
            </div>

            <div class="wrapper app-product">
                <h2>Deepkit ORM Browser</h2>

                <p>
                    Deepkit ORM Browser is a web application that allows you to browse your database schema, edit your
                    data, see migration changes, and seed your database. Everything based on your TypeScript entity
                    types.
                </p>

                <p>It is part of Framework Debugger but can also be used standalone.</p>

                <p>
                    <a class="button big" routerLink="/library/orm-browser">Learn more</a>
                </p>

                <app-images>
                    <app-image src="/assets/screenshots-orm-browser/content-editing.png"></app-image>
                    <app-image src="/assets/screenshots-orm-browser/model-diagram.png"></app-image>
                    <app-image src="/assets/screenshots-orm-browser/query.png"></app-image>
                    <app-image src="/assets/screenshots-orm-browser/seed.png"></app-image>
                </app-images>
            </div>

            <div class="wrapper app-product">
                <h2>Deepkit API Console</h2>

                <p>
                    Auto documentation of your HTTP and RPC API right in the browser showing all your routes, actions,
                    parameters, return types, status codes, in TypeScript type syntax.
                </p>

                <p>Interactively explore and test your API with the API Console.</p>

                <p>It is part of Framework Debugger but can also be used standalone.</p>

                <p>
                    <a class="button big" routerLink="/library/api-console">Learn more</a>
                </p>

                <app-images>
                    <app-image src="/assets/screenshots/api-console-http-get.png"></app-image>
                    <app-image src="/assets/screenshots/api-console-http-post.png"></app-image>
                    <app-image src="/assets/screenshots/api-console-overview.png"></app-image>
                    <app-image src="/assets/screenshots/api-console-overview-detail.png"></app-image>
                    <app-image src="/assets/screenshots/api-console-overview-detail-get.png"></app-image>
                </app-images>
            </div>

            <div class="wrapper app-product">
                <h2>Deepkit Debugger</h2>

                <p>Deepkit Framework Debugger is a web application giving you insights into your application.</p>

                <p>Module hiarchy, configuration, APIs, database, profiler, and much more.</p>

                <p>
                    <a class="button big" routerLink="/library/framework">Learn more</a>
                </p>

                <app-images>
                    <app-image src="/assets/screenshots/debugger-http.png"></app-image>
                    <app-image src="/assets/screenshots/debugger-modules.png"></app-image>
                    <app-image src="/assets/screenshots-profiler/overview.png"></app-image>
                    <app-image src="/assets/screenshots/debugger-configuration.png"></app-image>
                    <app-image src="/assets/screenshots/debugger-api-http.png"></app-image>
                </app-images>
            </div>
        </div>
    `,
})
export class LibrariesComponent {}
