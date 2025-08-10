import { Component, computed } from '@angular/core';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { bodyToString, parseBody } from '@app/common/models';
import { ControllerClient } from '@app/app/client';
import { ActivatedRoute } from '@angular/router';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { LoadingComponent } from '@app/app/components/loading';
import { injectRouteData } from 'ngxtension/inject-route-data';
import { derivedAsync } from 'ngxtension/derived-async';
import { pendingTask } from '@deepkit/desktop-ui';
import { HeaderComponent } from '@app/app/components/header.component.js';
import { FooterComponent } from '@app/app/components/footer.component.js';
import { ContentTextComponent } from '@app/app/components/content-text.component.js';


@Component({
    imports: [
        ContentRenderComponent,
        AppTitle,
        LoadingComponent,
        AppDescription,
        HeaderComponent,
        FooterComponent,
        ContentTextComponent,
    ],
    styles: `
      .wrapper {
        background: var(--color-content-text-bg);
        border-radius: 12px;
        padding: 15px;
      }
    `,
    template: `
      <dw-header />
      <div class="app-content-full" style="margin-top: 50px;">
        <dui-content-text class="wrapper"> 
          @if (page(); as page) {
          <app-title value="{{page.title}}"></app-title>
          <app-description [value]="page.title + ' - ' + bodyToString(subline())"></app-description>
          <app-render-content [content]="page.body"></app-render-content>
          } @else {
            <app-loading></app-loading>
          }
        </dui-content-text>
      </div>
      <dw-footer />
    `,
})
export class StaticPageComponent {
    routeData = injectRouteData();
    // page = signal<Page | undefined>(undefined);
    // subline = signal<Content | undefined>(undefined);

    page = derivedAsync(pendingTask(async () => {
        const slug = this.routeData().page;
        if (!slug) return undefined;
        return this.client.main.getPage('static/' + slug, 'en');
    }));

    subline = computed(() => {
        const page = this.page();
        if (!page) return undefined;
        return parseBody(page.body).subline;
    });

    constructor(
        private client: ControllerClient,
        private activatedRoute: ActivatedRoute,
    ) {
    }

    // ngOnInit() {
    //     this.activatedRoute.data.subscribe((params) => {
    //         this.load(params.page);
    //     });
    // }
    //
    // async load(slug: string) {
    //     this.page = await this.client.main.getPage('static/' + slug);
    //     console.log(this.page);
    //     if (!this.page) return;
    //     this.subline = parseBody(this.page.body).subline;
    // }

    protected readonly bodyToString = bodyToString;
}
