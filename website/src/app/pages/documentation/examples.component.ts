import { KeyValuePipe, NgForOf, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { LoadingComponent } from '@app/app/components/loading';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { UiCodeExample, projectMap } from '@app/common/models';

@Component({
    standalone: true,
    imports: [AppDescription, AppTitle, NgIf, LoadingComponent, NgForOf, RouterLink, KeyValuePipe],
    template: `
        <div class="app-content-full normalize-text">
            <app-loading *ngIf="loading"></app-loading>

            <app-title value="{{ title }}"></app-title>
            <app-description value="{{ title }}"></app-description>

            <div *ngIf="project" class="app-pre-headline">{{ project }}</div>
            <h1>Examples</h1>

            <p>Learn by example. Not the right example? Use the search to find Questions & Answers.</p>

            <div *ngFor="let kv of groups | keyvalue">
                <h3 id="{{ kv.key }}">{{ projectMap[kv.key] || kv.key }}</h3>

                <!--                <div class="app-examples small">-->
                <!--                    <a class="app-example-item" routerLink="/documentation/{{example.category}}/examples/{{example.slug}}" *ngFor="let example of kv.value">-->
                <!--                        {{example.title}}-->
                <!--                    </a>-->
                <!--                </div>-->

                <ul>
                    <li *ngFor="let m of kv.value">
                        <a routerLink="/documentation/{{ m.category }}/examples/{{ m.slug }}">
                            {{ m.title }}
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    `,
})
export class ExamplesComponent implements OnInit {
    projectMap = projectMap;
    category = '';
    project = '';
    loading = true;
    examples: UiCodeExample[] = [];
    title: string = 'Examples';

    groups: { [group: string]: UiCodeExample[] } = {};

    constructor(
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
    ) {}

    ngOnInit() {
        this.activatedRoute.params.subscribe(params => {
            this.load(params.category);
        });
    }

    async load(category?: string) {
        if (category) {
            this.project = projectMap[category] || category;
            this.category = category;
        } else {
            this.project = '';
            this.category = '';
        }
        this.loading = true;
        this.title = this.project ? `Examples for Deepkit ${this.project}` : 'Examples';

        try {
            this.examples = await this.client.main.getExamples(category || '', false, 1000);
            console.log('examples', this.examples);

            this.groups = {};
            for (const example of this.examples) {
                if (!this.groups[example.category]) this.groups[example.category] = [];
                this.groups[example.category].push(example);
            }
        } finally {
            this.loading = false;
        }
    }
}
