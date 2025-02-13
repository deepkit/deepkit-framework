import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PlatformHelper } from '@app/app/utils';

@Component({
    imports: [
        RouterLinkActive,
        RouterLink,
        FormsModule,
        RouterOutlet
    ],
    standalone: true,
    styleUrls: ['./documentation.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <div class="content-wrapper">
                <div class="menu-trigger"><a (click)="showMenu=!showMenu" class="button">Chapters</a></div>
                <div (click)="showMenu=false; true">
                    <router-outlet></router-outlet>
                </div>
            </div>

            <nav [class.showMenu]="showMenu" #nav (scrollend)="setScroll($event)">
                <div style="margin-bottom: 25px;">
                    <a routerLinkActive="active" routerLink="/documentation/introduction">Introduction</a>
<!--                    <a routerLinkActive="active" routerLink="/documentation/questions">Questions & Answers</a>-->
                    <a routerLinkActive="active" routerLink="/documentation/examples">Examples</a>
                    <a href="https://discord.com/invite/PtfVf7B8UU" target="_blank">Join Discord</a>
<!--                    <a routerLinkActive="active" routerLink="/documentation/learn-typescript">Learn TypeScript</a>-->
                </div>

                <div class="category">
                    <div class="category-title">App</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/app">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/arguments">Arguments & Flags</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/dependency-injection">Dependency Injection</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/modules">Modules</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/services">Services</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/events">Events</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/logger">Logger</a>
                    <a routerLinkActive="active" routerLink="/documentation/app/configuration">Configuration</a>
                </div>

                <div class="category">
                    <div class="category-title">Framework</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/framework">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/framework/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/framework/database">Database</a>
                    <a routerLinkActive="active" routerLink="/documentation/framework/testing">Testing</a>
                    <a routerLinkActive="active" routerLink="/documentation/framework/deployment">Deployment</a>
                    <a routerLinkActive="active" routerLink="/documentation/framework/public">Public Assets</a>
                </div>

                <div class="category">
                    <div class="category-title">Runtime Types</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/runtime-types">Introduction</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/getting-started">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/types">Type Annotations</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/reflection">Reflection</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/serialization">Serialization</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/validation">Validation</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/extend">Extend</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/custom-serializer">Custom serializer</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/external-types">External Types</a>
                    <a routerLinkActive="active" routerLink="/documentation/runtime-types/bytecode">Bytecode</a>
                </div>

                <div class="category">
                    <div class="category-title">Dependency Injection</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
                       routerLink="/documentation/dependency-injection">Introduction</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/getting-started">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/providers">Providers</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/injection">Injection</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/configuration">Configuration</a>
                    <a routerLinkActive="active" routerLink="/documentation/dependency-injection/scopes">Scopes</a>
                </div>

                <div class="category">
                    <div class="category-title">Filesystem</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/filesystem">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/app">App</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/local">Local</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/memory">Memory</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/aws-s3">AWS S3</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/ftp">FTP</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/sftp">sFTP (SSH)</a>
                    <a routerLinkActive="active" routerLink="/documentation/filesystem/google-storage">Google Storage</a>
                </div>

                <div class="category">
                    <div class="category-title">Broker</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/broker">Getting started</a>
<!--                    <a routerLinkActive="active" routerLink="/documentation/broker/examples">Examples</a>-->
                    <a routerLinkActive="active" routerLink="/documentation/broker/cache">Cache</a>
                    <a routerLinkActive="active" routerLink="/documentation/broker/message-bus">Message Bus</a>
                    <a routerLinkActive="active" routerLink="/documentation/broker/message-queue">Message Queue</a>
                    <a routerLinkActive="active" routerLink="/documentation/broker/atomic-locks">Atomic Locks</a>
                    <a routerLinkActive="active" routerLink="/documentation/broker/key-value">Key Value</a>
                </div>

                <div class="category">
                    <div class="category-title">HTTP</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
                       routerLink="/documentation/http">Introduction</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/getting-started">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/input-output">Input & Output</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/views">Views</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/dependency-injection">Dependency Injection</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/events">Events</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/middleware">Middleware</a>
                    <a routerLinkActive="active" routerLink="/documentation/http/security">Security</a>
                </div>

                <div class="category">
                    <div class="category-title">RPC</div>
                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
                       routerLink="/documentation/rpc">Introduction</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/getting-started">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/dependency-injection">Dependency Injection</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/security">Security</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/errors">Errors</a>
                    <a routerLinkActive="active" routerLink="/documentation/rpc/transport">Transport</a>
                </div>

                <div class="category">
                    <div class="category-title">Database ORM</div>

                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
                       routerLink="/documentation/orm">Introduction</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/getting-started">Getting started</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/examples">Examples</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/entity">Entity</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/session">Session</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/query">Query</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/transactions">Transaction</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/inheritance">Inheritance</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/relations">Relations</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/events">Events</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/migrations">Migrations</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/orm-browser">ORM Browser</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/raw-access">Raw Access</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/seeding">Seeding</a>
                    <a routerLinkActive="active" routerLink="/documentation/orm/composite-primary-key">Composite primary
                        key</a>
                    <div class="section-title">Plugins</div>
                    <section>
                        <a routerLinkActive="active" routerLink="/documentation/orm/plugin-soft-delete">Soft-Delete</a>
                    </section>
                </div>

                <!--                <div class="category">-->
                <!--                    <div class="category-title">Desktop UI</div>-->

                <!--                    <a routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" routerLink="/documentation/desktop-ui">Getting started</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/button">Button</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/button-group">Button group</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/dropdown">Dropdown</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/icons">Icons</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/input">Input</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/slider">Slider</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/radiobox">Radiobox</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/selectbox">Selectbox</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/checkbox">Checkbox</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/list">List</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/table">Table</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/window">Window</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/window-menu">Window menu</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/window-toolbar">Window toolbar</a>-->
                <!--                    <a routerLinkActive="active" routerLink="/documentation/desktop-ui/dialog">Dialog</a>-->
                <!--                </div>-->
            </nav>
        </div>
    `
})
export class DocumentationComponent implements AfterViewInit, OnDestroy {
    showMenu: boolean = false;
    scrolled = false;

    @ViewChild('nav') nav?: ElementRef;

    sub: Subscription;

    constructor(
        public platform: PlatformHelper,
        public router: Router,
    ) {
        this.sub = router.events.subscribe(() => {
            this.showMenu = false;
            this.scrollToActiveLink();
        });
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    setScroll(event: Event) {
        if (!this.nav) return;
        sessionStorage.setItem('documentation:sidebar:scrollTop', String(this.nav.nativeElement.scrollTop));
    }

    protected scrollToActiveLink() {
        if (!this.platform.isBrowser() || this.scrolled || !this.nav) return;
        if ('undefined' === typeof sessionStorage) return;

        const scrollTop = Number(sessionStorage.getItem('documentation:sidebar:scrollTop') || 0);
        if (scrollTop > 0) {
            this.scrolled = true;
            this.nav.nativeElement.scrollTop = scrollTop;
            return;
        }

        this.nav.nativeElement.querySelectorAll('a.active').forEach((el: any) => {
            this.scrolled = true;
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });
    }

    ngAfterViewInit() {
        this.scrollToActiveLink();
    }
}
