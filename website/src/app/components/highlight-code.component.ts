import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { ControllerClient } from '@app/app/client';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';

@Component({
    selector: 'highlight-code',
    styles: [
        `
            :host {
                display: block;
                margin: 12px 0;
                max-width: 100%;
            }

            pre {
                overflow: auto;
                overflow: overlay;
                scrollbar-width: thin;
                max-width: 100%;
                margin: 0;

                &::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
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
        `,
    ],
    standalone: true,
    template: ` <pre class="code codeHighlight" [attr.title]="meta.title" [innerHTML]="html"></pre> `,
})
export class HighlightCodeComponent implements OnInit, OnChanges {
    @Input() code: string = '';
    @Input() file: string = '';
    @Input() lang: string = 'typescript';
    @Input() meta: { title?: string } = {};

    html: string = '';

    constructor(private client: ControllerClient) {}

    async ngOnInit() {
        await this.render();
    }

    async ngOnChanges() {
        await this.render();
    }

    async render() {
        this.code = this.code.trim();
        if (!this.code) {
            //load from file
            if (!this.file) return;
            this.code = await this.client.main.getAsset(this.file);
        }
        if (!this.code) return;

        let lang = this.lang || 'typescript';
        if (!languages[lang]) lang = 'text';
        this.html = highlight(this.code, languages[lang], lang);
    }
}
