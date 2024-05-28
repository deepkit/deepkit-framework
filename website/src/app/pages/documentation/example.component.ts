import { Component, OnInit, signal } from '@angular/core';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { NgForOf, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { projectMap, UiCodeExample } from '@app/common/models';
import { LoadingComponent } from '@app/app/components/loading';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { PageResponse } from '@app/app/page-response';
import { waitForInit } from '@app/app/utils.js';


@Component({
    standalone: true,
    imports: [
        AppDescription,
        AppTitle,
        NgIf,
        LoadingComponent,
        NgForOf,
        RouterLink,
        ContentRenderComponent,
    ],
    template: `
        <div class="app-content-full normalize-text">
            @if (loading()) {
                <app-loading></app-loading>
            }

            @if (example(); as example) {
                <app-title value="{{example.title}} // Example for Deepkit {{project()}}"></app-title>

                <app-description value="Example for Deepkit {{project()}}"></app-description>

                @if (project()) {
                    <div class="app-pre-headline">{{ project() }} // Examples</div>
                }
                <h1>{{ example.title }}</h1>

                <a class="button" routerLink="/documentation/{{id()}}/examples">Back to all {{ project() }} examples</a>

                <a *ngIf="example.url" style="margin-left: 15px;" class="button" target="_blank" href="{{example.url}}">Full
                    Example</a>

                <app-render-content *ngIf="example.content" [content]="example.content"></app-render-content>
            }
        </div>
    `,
})
export class ExampleComponent implements OnInit {
    id = signal('');
    project = signal('');
    loading = signal(false);
    example = signal<UiCodeExample | undefined>(undefined);

    constructor(
        private pageResponse: PageResponse,
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        this.activatedRoute.params.subscribe(params => {
            this.load(params.category, params.slug);
        });
    }

    async load(category: string, slug: string) {
        this.project.set(projectMap[category] || category);
        this.id.set(category);
        this.loading.set(true);

        try {
            this.example.set(await this.client.main.getExample(category, slug));
        } catch {
            this.pageResponse.notFound();
        } finally {
            this.loading.set(false);
        }
    }
}
