import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { bodyToString, Content, Page, parseBody, projectMap } from '@app/common/models';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { LoadingComponent } from '@app/app/components/loading';
import { ViewportScroller } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { PageResponse } from '@app/app/page-response';
import { waitForInit } from '@app/app/utils';
import { ContentTextComponent } from '@app/app/components/content-text.component.js';
import { TableOfContentService } from '@app/app/components/table-of-content.component.js';

@Component({
    imports: [
        AppDescription,
        AppTitle,
        ContentRenderComponent,
        LoadingComponent,
        ContentTextComponent,
    ],
    styleUrls: ['./page.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <!--        <nav class="table-of-content">-->
      <!--          @for (h of headers(); track h) {-->
      <!--            <a [href]="router.url.split('#')[0] + '#' + h.link" class="intend-{{h.indent}}">-->
      <!--              {{ h.label }}-->
      <!--            </a>-->
      <!--          }-->
      <!--        </nav>-->
      <div class="app-content">
        <dui-content-text>
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
            <div #content>
              <app-title value="{{page.title}} Documentation"></app-title>

              <app-description
                [value]="page.title + ' Documentation - ' + bodyToString(subline())"></app-description>

              @if (project(); as project) {
                <div class="app-pre-headline">{{ project }}</div>
              }
              <app-render-content [content]="page.body" (onRender)="loadTableOfContent()"></app-render-content>
            </div>
          }
          <!--            <app-ask [fixed]="true"></app-ask>-->
        </dui-content-text>
      </div>
    `,
})
export class DocumentationPageComponent implements OnInit, OnDestroy {
    protected readonly bodyToString = bodyToString;
    loading = signal(false);
    error = signal('');
    page = signal<Page | undefined>(undefined);
    project = signal('');
    subline = signal<Content | undefined>(undefined);
    currentPath = signal('');

    content = viewChild('content', { read: ElementRef<HTMLElement> });

    toc = inject(TableOfContentService);

    constructor(
        private pageResponse: PageResponse,
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
        private viewportScroller: ViewportScroller,
        public router: Router,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        this.activatedRoute.url.subscribe(async (url) => {
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
        this.currentPath.set(path);

        try {
            const page = await this.client.main.getPage('documentation/' + path);
            if (!page) return;
            this.page.set(page);
            this.subline.set(parseBody(page.body).subline);
        } catch (error) {
            this.pageResponse.notFound();
            this.page.set(undefined);
            this.error.set(String(error));
        } finally {
            this.loading.set(false);
        }

        const fragment = this.activatedRoute.snapshot.fragment;
        if (fragment) {
            this.viewportScroller.scrollToAnchor(fragment);
        }
    }

    ngOnDestroy() {
        const content = this.content();
        if (!content || !content.nativeElement) return;
        this.toc.unregister(content.nativeElement);
    }

    loadTableOfContent() {
        const content = this.content();
        if (!content || !content.nativeElement) return;
        setTimeout(() => {
            this.toc.render(content.nativeElement);
        }, 100);
    }
}
