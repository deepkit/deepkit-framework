import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
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
        '[class.inline]': 'inline()',
    },
    styleUrl: './code-highlight.component.scss',
    template: `
      <ng-content></ng-content>
      <pre class="code codeHighlight text-selection language-{{lang()}}" [attr.title]="title() || undefined" [innerHTML]="html()"></pre>
    `,
    encapsulation: ViewEncapsulation.None,
})
export class CodeHighlightComponent {
    code = input<any>('');
    file = input('');
    lang = input('typescript');
    title = input<string>('');

    inline = input(false, { transform: booleanAttribute });

    html = computed(() => {
        const raw = this.code();
        const code = 'string' === typeof raw ? raw : JSON.stringify(raw) || '';

        const firstLineIndentLength = code.match(/^\s+/)?.[0].length || 1;
        // Remove leading whitespace from each line
        const trimmedCode = code.split('\n').map(line => line.slice(firstLineIndentLength - 1)).join('\n').trim();

        let lang = this.lang() || 'typescript';
        if (!prism.languages[lang]) lang = 'text';
        return prism.highlight(trimmedCode, prism.languages[lang], lang);
    });
}
