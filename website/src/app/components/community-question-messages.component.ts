import { Component, Input } from "@angular/core";
import { CommunityQuestion } from "@app/common/models";
import { ContentRenderComponent } from "@app/app/components/content-render.component";
import { NgForOf, NgIf } from "@angular/common";

@Component({
    standalone: true,
    selector: 'app-community-question',
    styles: [`
        .message {
            padding: 25px 0;
            border-top: 1px solid #1E1E1E;
            display: flex;
            flex-direction: row;

            .image {
                width: 70px;
                text-align: center;
                padding-top: 5px;

                img {
                    width: 40px;
                    border-radius: 100%;
                }
            }

            .content {
                flex: 1;
            }

            app-render-content > *:first-child {
                margin-top: 0;
                padding-top: 0;
            }

            .user {
                color: #2ecc71;
                font-weight: bold;
            }
        }

    `],
    imports: [
        ContentRenderComponent,
        NgIf,
        NgForOf
    ],
    template: `
        <div class="message">
            <div class="image" *ngIf="question.userAvatar">
                <img [src]="question.userAvatar" class="avatar" alt="User Avatar"/>
            </div>
            <div class="content">
                <div class="user" *ngIf="question.user">&#64;{{question.user}}</div>
                <app-render-content [content]="question.content"></app-render-content>
            </div>
        </div>

        <div class="message" *ngFor="let m of question.messages">
            <div class="image" *ngIf="m.userAvatar">
                <img [src]="m.userAvatar" class="avatar" alt="User Avatar"/>
            </div>
            <div class="content" id="answer-{{m.id}}">
                <div class="user" *ngIf="m.user">&#64;{{m.user}}</div>
                <app-render-content [content]="m.content"></app-render-content>
            </div>
        </div>

    `
})
export class CommunityQuestionMessagesComponent {
    @Input() question!: CommunityQuestion;
}
