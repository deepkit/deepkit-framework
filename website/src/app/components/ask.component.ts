import { ChangeDetectorRef, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ControllerClient } from "@app/app/client";
import { Router } from "@angular/router";
import { Content } from "@app/common/models";
import { NgIf } from "@angular/common";
import { ContentRenderComponent } from "@app/app/components/content-render.component";
import { AppTitle } from "@app/app/components/title";

@Component({
    selector: 'app-ask',
    imports: [
        FormsModule,
        NgIf,
        ContentRenderComponent,
        AppTitle
    ],
    styles: [`
        .ask-question {
            position: fixed;
            bottom: 0;
            right: 0;
            left: 0;
            pointer-events: none;
        }

        .wrapper {
            max-width: 690px;
        }

        .box {
            pointer-events: all;
            padding: 20px 30px;
            background-color: rgba(14, 18, 23, 0.95);
        }

        input {
            height: 36px;
            width: 100%;
            font-size: 15px;
            padding: 8px 14px;
        }

        .results {
            overflow: auto;
            max-height: calc(100vh - 160px);
            padding: 25px;
            background-color: black;
        }
    `],
    template: `
        <div [class.ask-question]="fixed">
            <div class="wrapper">
                <div class="box">
                    <div>
                        <div class="results scroll-small">
                            <app-render-content [content]="content"></app-render-content>
                        </div>

                        <input (focus)="visible = true" (keyup)="onKeyUp($event)" (click)="visible=true"
                               placeholder="Ask a question" [(ngModel)]="query"/>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class AskComponent {
    query = '';

    loading = false;
    visible = false;

    content: (string | Content)[] = [];

    @Input() fixed = false;

    constructor(
        protected client: ControllerClient,
        protected router: Router,
        protected cd: ChangeDetectorRef,
    ) {
    }

    onKeyUp(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            this.visible = false;
        } else if (e.key === 'Enter') {
            this.prompt(this.query);
        } else {
            this.visible = true;
        }
    }

    async prompt(text: string) {
        if (!text) return;
        let url = this.router.url;
        //remove fragment
        url = url.replace(/#.*$/, '');
        // const response = await this.client.main.askDoc(text, url);
        //
        // console.log('start');
        // response.subscribe((next) => {
        //     console.log('next', next);
        //
        //     //remove the last next.remove items
        //     if (next.remove) this.content = this.content.slice(0, -next.remove);
        //     this.content = this.content.concat(next.next);
        //
        //     this.cd.detectChanges();
        // });
    }
}
