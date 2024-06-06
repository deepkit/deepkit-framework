import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { ControllerClient } from '@app/app/client';
import { CommunityQuestionListItem, projectMap } from '@app/common/models';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { waitForInit } from '@app/app/utils';

@Component({
    standalone: true,
    imports: [
        ContentRenderComponent,
        RouterLink,
        DatePipe
    ],
    selector: 'render-questions',
    styles: [`
        .question {
            overflow: hidden;
            padding: 10px 25px;

            &:hover {
                background: rgba(15, 15, 15, 0.40);
            }

            &:not(:last-child) {
                border-bottom: 1px solid #1E1E1E;
            }

            display: flex;
            flex-direction: row;
            align-items: center;

            .title {
                display: flex;
                flex-direction: column;
                flex: 1;

                .votes {
                    color: #979797;
                    line-height: 16px;
                    font-size: 13px;
                }
            }

            .actions {
                margin-left: auto;
            }

            .actions .row {
                display: flex;
                flex-direction: row;
                height: 26px;

                > * {
                    margin-left: 15px;
                }
            }

            .button {
                font-size: 12px;
                line-height: 12px;
            }
        }
    `],
    template: `
        <div class="questions app-box-transparent">
            @for (question of questions; track $index) {
                <div class="question">
                    <div class="title">
                        <!--                    <div class="votes">-->
                        <!--                        {{question.votes}} up-votes-->
                        <!--                    </div>-->
                        <a routerLink="/documentation/questions/post/{{question.slug}}">{{ question.title }}</a>
                    </div>

                    <div class="actions">
                        <div class="row">
                            <div class="app-tag">{{ projectMap[question.category] || 'General' }}</div>
                            @if (question.discordUrl) {
                                <a class="button" [href]="question.discordUrl" target="_blank">Discord</a>
                            }
                        </div>
                    </div>
                </div>
            }
        </div>
    `
})
export class RenderQuestions {
    projectMap = projectMap;
    @Input() questions: CommunityQuestionListItem[] = [];
}

@Component({
    standalone: true,
    imports: [
        ContentRenderComponent,
        RouterLink,
        DatePipe,
        RenderQuestions,
        KeyValuePipe
    ],
    styleUrls: ['./community-questions.component.scss'],
    template: `
        <div class="app-content-full normalize-text">
            <h1>Questions & Answers</h1>
            <p>
                All public questions answered by our Deepkit Discord bot are collected here.
            </p>

            <!--            <div class="app-note">-->
            <!--                How to ask a question:-->
            <!--                <ul>-->
            <!--                    <li>Join our discord and ping <code>@deepkit</code>.</li>-->
            <!--                    <li>Open a documentation page and enter your question in the chat box on the bottom.</li>-->
            <!--                    <li>Open the Chat Bot.</li>-->
            <!--                </ul>-->
            <!--            </div>-->

            <p class="buttons">
                <a class="button big" href="https://discord.gg/PtfVf7B8UU" target="_blank">Join our Discord</a>
                <!--                <a class="button big" routerLink="./post/ask">Open Chat Bot</a>-->
            </p>

            @for (kv of groups()|keyvalue; track $index) {
                <div>
                    <h2 id="{{kv.key}}">{{ projectMap[kv.key] || kv.key }}</h2>

                    <ul>
                        @for (m of kv.value; track $index) {
                            <li>
                                <a routerLink="/documentation/questions/post/{{m.slug}}">
                                    {{ m.title }}
                                </a>
                            </li>
                        }
                    </ul>
                </div>
            }

            <!--            <h2>New Questions</h2>-->

            <!--            <render-questions [questions]="questions.newest"></render-questions>-->

            <h2>How to Chat</h2>

            <p>
                How does the bot work in Discord? First of all, you have to join our Discord server. Then, you can ping
                the bot
                with <code>&#64;deepkit</code> and ask your question. The bot will automatically create a new thread for
                you and answer
                your question in a new message.
            </p>

            <p>
                Now, after you got the first answer, you can continue chatting with the bot by keep pinging it. If you
                are not satisfied
                with the answer, you can ask the bot to edit and fix it. The bot will then edit its previous message
                until you are satisfied.
                You can of course also create follow-up questions, which the bot will answer in the same thread.
            </p>

            <p>
                By carefully asking questions and asking the bot to edit its message, you can create a nice and clean
                documentation page not only for your, but other users as well
                since
                all questions and answers are public on this page.
            </p>

        </div>

    `
})
export class CommunityQuestionsComponent implements OnInit {
    groups = signal<{ [group: string]: CommunityQuestionListItem[] }>({});
    questions = signal<{ top: CommunityQuestionListItem[], newest: CommunityQuestionListItem[] }>({ top: [], newest: [] });

    constructor(
        protected activatedRoute: ActivatedRoute,
        protected client: ControllerClient,
    ) {
        waitForInit(this, 'load');
    }

    ngOnInit() {
        // this.activatedRoute.params.subscribe(params => {
            this.load();
        // });
    }

    async load() {
        const questions = await this.client.main.getQuestions();

        const groups: any = {};
        for (const m of questions.top) {
            if (!groups[m.category]) groups[m.category] = [];
            groups[m.category].push(m);
        }
        this.questions.set(questions);
        this.groups.set(groups);
    }

    protected readonly projectMap = projectMap;
}
