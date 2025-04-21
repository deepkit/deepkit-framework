import { Component, OnInit, signal } from '@angular/core';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { KeyValuePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { projectMap, UiCodeExample } from '@app/common/models';
import { LoadingComponent } from '@app/app/components/loading';
import { waitForInit } from '@app/app/utils';


@Component({
    imports: [
        AppDescription,
        AppTitle,
        LoadingComponent,
        RouterLink,
        KeyValuePipe,
    ],
    template: `
        <div class="app-content-full normalize-text">
            @if (loading()) {
                <app-loading></app-loading>
            }

            <app-title value="{{title()}}"></app-title>
            <app-description value="{{title()}}"></app-description>

            @if (project()) {
                <div class="app-pre-headline">{{ project() }}</div>
            }
            <h1>Examples</h1>

            <p>
                Learn by example. Not the right example? Use the search to find Questions & Answers.
            </p>

            @for (kv of groups()|keyvalue; track $index) {
                <div>
                    <h3 id="{{kv.key}}">{{ projectMap[kv.key] || kv.key }}</h3>

                    <!--                <div class="app-examples small">-->
                    <!--                    <a class="app-example-item" routerLink="/documentation/{{example.category}}/examples/{{example.slug}}" *ngFor="let example of kv.value">-->
                    <!--                        {{example.title}}-->
                    <!--                    </a>-->
                    <!--                </div>-->

                    <ul>
                        @for (m of kv.value; track $index) {
                            <li>
                                <a routerLink="/documentation/{{m.category}}/examples/{{m.slug}}">
                                    {{ m.title }}
                                </a>
                            </li>
                        }
                    </ul>
                </div>
            }
        </div>
    `
})
export class ExamplesComponent implements OnInit {
    projectMap = projectMap;
    category = signal('');
    project = signal('');
    loading = signal(false);
    examples = signal<UiCodeExample[]>([]);
    title = signal('Examples');

    groups = signal<{ [group: string]: UiCodeExample[] }>({});

    constructor(
        private activatedRoute: ActivatedRoute,
        private client: ControllerClient,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        this.activatedRoute.params.subscribe(params => {
            this.load(params.category);
        });
    }

    async load(category?: string) {
        if (category) {
            this.project.set(projectMap[category] || category);
            this.category.set(category);
        } else {
            this.project.set('');
            this.category.set('');
        }
        this.loading.set(true);
        this.title.set(this.project() ? `Examples for Deepkit ${this.project()}` : 'Examples');

        try {
            this.examples.set(await this.client.main.getExamples(category || '', false, 1000));

            const groups: {[name: string]: UiCodeExample[]} = {};
            for (const example of this.examples()) {
                if (!groups[example.category]) groups[example.category] = [];
                groups[example.category].push(example);
            }
            this.groups.set(groups);
        } finally {
            this.loading.set(false);
        }
    }
}
