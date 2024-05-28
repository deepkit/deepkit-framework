import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { bodyToString, Content, Page, parseBody, projectMap } from '@app/common/models';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { AskComponent } from '@app/app/components/ask.component';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { LoadingComponent } from '@app/app/components/loading';
import { NgForOf, NgIf, ViewportScroller } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { PageResponse } from '@app/app/page-response';
import { waitForInit } from '@app/app/utils.js';

@Component({
    standalone: true,
    imports: [
        AppDescription,
        AppTitle,
        AskComponent,
        ContentRenderComponent,
        LoadingComponent,
        NgIf,
        NgForOf,
    ],
    styleUrls: ['./page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="table-of-content">
            <a [href]="router.url.split('#')[0] + '#' + h.link" class="intend-{{h.indent}}" *ngFor="let h of headers()">
                {{ h.label }}
            </a>
        </div>
        <div class="app-content normalize-text">
            @if (loading()) {
                <app-loading></app-loading>
            }

            @if (project(); as project) {
                <app-title value="{{project}}"></app-title>
            }
            @if (error(); as error) {
                <div class="error">
                    {{ error }}
                </div>
            }
            @if (page(); as page) {
                <div>
                    <app-title value="{{page.title}} Documentation"></app-title>

                    <app-description
                        [value]="page.title + ' Documentation - ' + bodyToString(subline())"></app-description>

                    @if (project(); as project) {
                        <div class="app-pre-headline">{{ project }}</div>
                    }
                    <app-render-content [content]="page.body"></app-render-content>
                </div>
            }
            <!--            <app-ask [fixed]="true"></app-ask>-->
        </div>
    `,
})
export class DocumentationPageComponent implements OnInit {
    protected readonly bodyToString = bodyToString;
    loading = signal(false);
    error = signal('');
    page = signal<Page | undefined>(undefined);
    project = signal('');
    subline = signal<Content | undefined>(undefined);
    currentPath = signal('');
    public headers = signal<{ label: string, indent: number, link: string }[]>([]);

    constructor(
        private pageResponse: PageResponse,
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
        private cd: ChangeDetectorRef,
        private viewportScroller: ViewportScroller,
        public router: Router,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        this.activatedRoute.url.subscribe(async (url) => {
            console.log('url', url);
            if (url.length > 1) {
                await this.load(url[1].path, url[0].path);
            } else if (url.length === 1) {
                await this.load(url[0].path);
            } else {
                await this.load('');
            }
        });
    }

    ngAfterViewInit() {
        this.loadTableOfContent();
    }

    onOutlet(event: any) {
        this.loadTableOfContent();
    }

    async load(path: string, project: string = '') {
        this.project.set(projectMap[project] || project);
        path = path || 'index';
        if (project) path = project + '/' + path;

        if (this.currentPath() === path) return;

        this.error.set('');
        this.loading.set(true);
        this.cd.detectChanges();
        this.headers.set([]);
        this.currentPath.set(path);

        try {
            const page = await this.client.main.getPage('documentation/' + path);
            console.log('page', path, page);
            if (!page) return;
            this.page.set(page);
            this.subline.set(parseBody(page.body).subline);

            this.loadTableOfContent();
        } catch (error) {
            this.pageResponse.notFound();
            this.page.set(undefined);
            this.error.set(String(error));
        } finally {
            this.loading.set(false);
        }
        this.cd.detectChanges();

        const fragment = this.activatedRoute.snapshot.fragment;
        if (fragment) {
            this.viewportScroller.scrollToAnchor(fragment);
        }
    }

    loadTableOfContent() {
        const headers: any[] = [];
        const page = this.page();
        if (!page) return [];

        for (const child of page.body.children || []) {
            if ('string' === typeof child) continue;
            if (!child.children) continue;
            const first = child.children[0];
            if ('string' !== typeof first) continue;
            if (!child.props) continue;

            if (child.tag === 'h2') {
                headers.push({ label: first, indent: 0, link: child.props.id });
            } else if (child.tag === 'h3') {
                headers.push({ label: first, indent: 1, link: child.props.id });
            }
        }
        this.headers.set(headers);
    }
}
