import { booleanAttribute, Component, computed, inject, Injectable, input, PendingTasks, ViewEncapsulation } from '@angular/core';
import { type default as PrismT } from 'prismjs';
import { derivedAsync } from 'ngxtension/derived-async';
import { asyncOperation } from '@deepkit/core';
import { pendingTask } from '@deepkit/desktop-ui';

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
    protected prism = inject(Prism);

    html = computed(() => {
        const raw = this.code();
        return this.prism.highlight(raw, this.lang());
    });
}

const prism = asyncOperation<typeof PrismT>(async (resolve) => {
    const Prism = globalThis.Prism = (await import('prismjs')).default;
    // @ts-ignore
    await import('prismjs/components/prism-typescript');
    // @ts-ignore
    await import('prismjs/components/prism-jsx');
    // @ts-ignore
    await import('prismjs/components/prism-tsx');
    // @ts-ignore
    await import('prismjs/components/prism-sql');
    // @ts-ignore
    await import('prismjs/components/prism-bash');
    // @ts-ignore
    await import('prismjs/components/prism-json');
    resolve(Prism as typeof PrismT);
});

@Injectable({ providedIn: 'root' })
export class Prism {
    taskService = inject(PendingTasks);

    prism = derivedAsync(pendingTask(() => prism));
    ready = prism;

    constructor() {
        this.taskService.run(() => prism);
    }

    highlight(raw: any, lang: string): string {
        const prism = this.prism();
        if (!prism) return '';
        const code = 'string' === typeof raw ? raw : JSON.stringify(raw) || '';
        const firstLineIndentLength = code.match(/^\s+/)?.[0].length || 1;
        // Remove leading whitespace from each line
        const trimmedCode = code.split('\n').map(line => line.slice(firstLineIndentLength - 1)).join('\n').trim();

        lang ||= 'typescript';
        if (!prism.languages[lang]) lang = 'text';
        return prism.highlight(trimmedCode, prism.languages[lang], lang);
    }
}
