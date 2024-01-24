import { NgForOf, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { LoadingComponent } from '@app/app/components/loading';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { PageResponse } from '@app/app/page-response';
import { UiCodeExample, projectMap } from '@app/common/models';

@Component({
    standalone: true,
    imports: [AppDescription, AppTitle, NgIf, LoadingComponent, NgForOf, RouterLink, ContentRenderComponent],
    template: `
        <div class="app-content-full normalize-text">
            <app-loading *ngIf="loading"></app-loading>

            <ng-container *ngIf="example">
                <app-title value="{{ example.title }} // Example for Deepkit {{ project }}"></app-title>

                <app-description value="Example for Deepkit {{ project }}"></app-description>

                <div *ngIf="project" class="app-pre-headline">{{ project }} // Examples</div>
                <h1>{{ example.title }}</h1>

                <a class="button" routerLink="/documentation/{{ id }}/examples">Back to all {{ project }} examples</a>

                <a
                    *ngIf="example.url"
                    style="margin-left: 15px;"
                    class="button"
                    target="_blank"
                    href="{{ example.url }}"
                    >Full Example</a
                >

                <app-render-content *ngIf="example.content" [content]="example.content"></app-render-content>
            </ng-container>
        </div>
    `,
})
export class ExampleComponent implements OnInit {
    id = '';
    project = '';
    loading = true;
    example?: UiCodeExample;

    constructor(
        private pageResponse: PageResponse,
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
    ) {}

    ngOnInit() {
        this.activatedRoute.params.subscribe(params => {
            this.load(params.category, params.slug);
        });
    }

    async load(category: string, slug: string) {
        this.project = projectMap[category] || category;
        this.id = category;
        this.loading = true;

        try {
            this.example = await this.client.main.getExample(category, slug);
        } catch {
            this.pageResponse.notFound();
        } finally {
            this.loading = false;
        }
    }
}
