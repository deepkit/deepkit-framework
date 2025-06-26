import { Component, Input } from '@angular/core';
import { CommunityQuestion } from '@app/common/models';
import { ContentRenderComponent } from '@app/app/components/content-render.component';


@Component({
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
    ContentRenderComponent
],
    template: `
        <div class="message">
          @if (question.userAvatar) {
            <div class="image">
              <img [src]="question.userAvatar" class="avatar" alt="User Avatar"/>
            </div>
          }
          <div class="content">
            @if (question.user) {
              <div class="user">&#64;{{question.user}}</div>
            }
            <app-render-content [content]="question.content"></app-render-content>
          </div>
        </div>
        
        @for (m of question.messages; track m) {
          <div class="message">
            @if (m.userAvatar) {
              <div class="image">
                <img [src]="m.userAvatar" class="avatar" alt="User Avatar"/>
              </div>
            }
            <div class="content" id="answer-{{m.id}}">
              @if (m.user) {
                <div class="user">&#64;{{m.user}}</div>
              }
              <app-render-content [content]="m.content"></app-render-content>
            </div>
          </div>
        }
        
        `
})
export class CommunityQuestionMessagesComponent {
    @Input() question!: CommunityQuestion;
}
