import { Component, computed, input } from '@angular/core';
// @ts-ignore
import * as prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';

@Component({
    selector: 'code-highlight',
    host: {
        '[class.overlay-scrollbar-small]': 'true',
    },
    styles: [`
        :host {
            display: block;
            margin: 12px 0;
            max-width: 100%;
        }

        pre {
            overflow: auto;
            overflow: overlay;
            @supports not (-webkit-hyphens: none) {
                /* in safari this breaks scrolling styling, so we need to exclude it*/
                scrollbar-width: thin;
            }
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
    template: `
      <ng-content></ng-content>
      <pre class="code codeHighlight text-selection language-{{lang()}}" [attr.title]="title()" [innerHTML]="html()"></pre>
    `,
})
export class CodeHighlightComponent {
    code = input('');
    file = input('');
    lang = input('typescript');
    title = input<string>('');

    html = computed(() => {
        const code = this.code();
        if (!code) return '';

        const firstLineIndentLength = code.match(/^\s+/)?.[0].length || 1;
        // Remove leading whitespace from each line
        const trimmedCode = code.split('\n').map(line => line.slice(firstLineIndentLength - 1)).join('\n').trim();

        let lang = this.lang() || 'typescript';
        if (!prism.languages[lang]) lang = 'text';
        return prism.highlight(trimmedCode, prism.languages[lang], lang);
    });
}
