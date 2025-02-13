import { Component, OnInit, signal } from '@angular/core';
import { ControllerClient } from '@app/app/client';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { bodyToString, CommunityQuestion, Content, Page, parseBody, UiCodeExample } from '@app/common/models';
import { AppDescription, AppTitle } from '@app/app/components/title';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { LoadingComponent } from '@app/app/components/loading';
import { PageResponse } from '@app/app/page-response';
import { waitForInit } from '@app/app/utils';

@Component({
    imports: [
        AppTitle,
        AppDescription,
        ContentRenderComponent,
        RouterLink,
        LoadingComponent,
    ],
    styleUrls: ['./library.component.scss'],
    template: `
        <div class="app-content-full">
            <div class="wrapper">
                @if (page(); as page) {
                    <div>
                        <app-title value="{{page.title}}"></app-title>

                        <div class="head">
                            <h1>{{ page.title }}</h1>

                            <nav>
                                <a routerLink="/{{page.url}}" class="active">Overview</a>
                                @if (page.params.category) {
                                    <a routerLink="/documentation/questions"
                                       [fragment]="page.params.category">FAQ</a>
                                }
                                @if (page.params.category) {
                                    <a routerLink="/documentation/{{page.params.category}}/examples">Examples</a>
                                }
                                <a routerLink="/documentation/{{page.params.doc}}">Documentation</a>
                                @if (page.params.api) {
                                    <a target="_blank"
                                       href="https://api.framework.deepkit.io/modules/{{page.params.api}}.html">API</a>
                                }
                            </nav>
                        </div>

                        <app-description [value]="page.title + ' - ' + bodyToString(subline())"></app-description>

                        @if (page.params.package) {
                            <div class="package">{{ page.params.package }}</div>
                        }

                        <app-render-content [content]="page.body"></app-render-content>

                        @if (page.params.category) {
                            <h2 id="faq" style="text-align: center">Questions & Answers</h2>

                            <div class="faqs">
                                @for (faq of faqs(); track $index) {
                                    <div class="faq">
                                        <div class="question">{{ $index + 1 }}. {{ faq.title }}</div>
                                        <div class="answer">
                                            <app-render-content [content]="faq.content"></app-render-content>
                                        </div>
                                    </div>
                                }

                                <div style="text-align: center">
                                    <p>
                                        No answer for your question? Ask a question or see all questions.
                                    </p>
                                    <a class="button big" style="margin-right: 25px;"
                                       routerLink="/documentation/questions/category/{{page.params.category}}">See all
                                        questions</a>
                                    <a class="button big" routerLink="/documentation/questions/">Ask a question</a>
                                </div>
                            </div>

                            <h2 id="examples">Examples</h2>

                            <div class="app-examples">
                                @for (example of examples(); track $index) {
                                    <a class="app-example-item"
                                       routerLink="/documentation/{{example.category}}/examples/{{example.slug}}">
                                        {{ example.title }}
                                    </a>
                                }
                            </div>

                            <div style="text-align: center; margin-top: 50px;">
                                <p>
                                    <a class="button big" style="margin-right: 25px;"
                                       routerLink="/documentation/{{page.params.category}}/examples">See all
                                        examples</a>
                                </p>
                            </div>
                        }
                    </div>
                } @else {
                    <app-loading></app-loading>
                }
            </div>
        </div>
    `,
})
export class LibraryComponent implements OnInit {
    subline = signal<Content | undefined>(undefined);
    page = signal<Page | undefined>(undefined);
    faqs = signal<CommunityQuestion[]>([]);
    examples = signal<UiCodeExample[]>([]);

    constructor(
        private pageResponse: PageResponse,
        private client: ControllerClient,
        private activatedRoute: ActivatedRoute,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        this.activatedRoute.params.subscribe(async (params) => {
            await this.load(params.id);
        });
    }

    async load(slug: string) {
        try {
            const page = await this.client.main.getPage('library/' + slug);
            this.page.set(page);
            this.subline.set(parseBody(page.body).subline);

            if (page.params.category) {
                this.faqs.set(await this.client.main.getFAQ(page.params.category));
                this.examples.set(await this.client.main.getExamples(page.params.category, false, 24));
            } else {
                this.faqs.set([]);
                this.examples.set([]);
            }
        } catch {
            this.pageResponse.notFound();
        }
    }

    protected readonly bodyToString = bodyToString;
}
