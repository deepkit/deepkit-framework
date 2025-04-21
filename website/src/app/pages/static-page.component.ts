import { Component, OnInit } from '@angular/core';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { bodyToString, Content, Page, parseBody } from '@app/common/models';
import { ControllerClient } from '@app/app/client';
import { ActivatedRoute } from '@angular/router';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { LoadingComponent } from '@app/app/components/loading';
import { NgIf } from '@angular/common';


@Component({
    imports: [
        ContentRenderComponent,
        AppTitle,
        LoadingComponent,
        NgIf,
        AppDescription,
    ],
    template: `
        <div class="app-content normalize-text" style="margin-top: 50px;">
            <app-loading *ngIf="!page"></app-loading>

            <div *ngIf="page">
                <app-title value="{{page.title}}"></app-title>

                <app-description [value]="page.title + ' - ' + bodyToString(subline)"></app-description>

                <app-render-content [content]="page.body"></app-render-content>
            </div>
        </div>
    `,
})
export class StaticPageComponent implements OnInit {
    page?: Page;
    subline?: Content;

    constructor(
        private client: ControllerClient,
        private activatedRoute: ActivatedRoute,
    ) {
    }

    ngOnInit() {
        this.activatedRoute.data.subscribe((params) => {
            this.load(params.page);
        });
    }

    async load(slug: string) {
        this.page = await this.client.main.getPage('static/' + slug);
        if (!this.page) return;
        this.subline = parseBody(this.page.body).subline;
    }

    protected readonly bodyToString = bodyToString;
}
