import { Component, inject, input } from '@angular/core';
import { Prism } from '@deepkit/ui-library';
import { derivedAsync } from 'ngxtension/derived-async';
import { ControllerClient } from '@app/app/client.js';
import { pendingTask } from '@deepkit/desktop-ui';

@Component({
    selector: 'highlight-code',
    styles: [`
        :host {
            display: block;
            margin: 12px 0;
            max-width: 100%;
        }

        pre {
            overflow: auto;
            overflow: overlay;
            max-width: 100%;
            margin: 0;

            scrollbar-color: rgba(169, 173, 175, 0.77) transparent;

            &::-webkit-scrollbar {
                height: 10px;
                width: 10px;
                background: transparent;
            }

            &::-webkit-scrollbar-thumb {
                background: rgba(169, 173, 175, 0.77);
                border-radius: 8px;
                border: 2px solid rgba(0, 0, 0, 0.01);
                background-clip: padding-box;

                &:hover {
                    cursor: default;
                    background: #727475;
                    border: 2px solid rgba(0, 0, 0, 0.01);
                    background-clip: padding-box;
                }
            }
        }

        pre.codeHighlight[title] {
            padding-top: 8px;
        }

        pre.codeHighlight[title]:before {
            display: block;
            text-align: center;
            content: attr(title);
            margin-bottom: 10px;
            font-size: 14px;
            color: #b0b0b0;
            font-style: italic;
        }
    `],
    standalone: true,
    template: `
      <pre class="code codeHighlight" [attr.title]="title() || undefined" [innerHTML]="html()"></pre>
    `,
})
export class HighlightCodeComponent {
    code = input('');
    file = input('');
    lang = input('typescript');
    title = input('');

    protected prism = inject(Prism);
    protected client = inject(ControllerClient);

    html = derivedAsync(pendingTask(async () => {
        await this.prism.ready;

        let code = this.code().trim();
        if (!code) {
            // load from file
            if (!this.file()) return '';
            code = await this.client.main.getAsset(this.file());
        }
        if (!code) return;

        return this.prism.highlight(code, this.lang());
    }));
}
