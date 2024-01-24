import { isPlatformBrowser } from '@angular/common';
import {
    AfterViewInit,
    Directive,
    DoCheck,
    ElementRef,
    Inject,
    Input,
    OnChanges,
    OnInit,
    PLATFORM_ID,
    Renderer2,
} from '@angular/core';
//@ts-ignore
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';

import { removeIndent } from '../utils';

@Directive({
    selector: '[codeHighlight]',
})
export class CodeHighlightComponent implements OnInit, OnChanges, AfterViewInit, DoCheck {
    @Input() codeHighlight: string = 'typescript';
    @Input() code: string = '';
    @Input() title?: string;

    protected pre?: HTMLPreElement;

    isBrowser = isPlatformBrowser(this.platformId);

    constructor(
        protected elementRef: ElementRef<HTMLTextAreaElement | HTMLDivElement>,
        protected renderer: Renderer2,
        @Inject(PLATFORM_ID) protected platformId: any,
    ) {}

    ngOnChanges(): void {
        this.render();
    }

    ngOnInit(): void {
        this.render();
    }

    ngAfterViewInit() {
        if (!this.elementRef.nativeElement.parentNode) {
            //try again next tick
            setTimeout(() => {
                return this.render();
            });
            return;
        }
        this.render();
    }

    ngDoCheck() {
        // queueMicrotask(() => {
        //     if (!this.pre) return;
        //     this.elementRef.nativeElement.after(this.pre);
        // });
    }

    render() {
        if (this.elementRef.nativeElement instanceof HTMLTextAreaElement) {
            this.code = removeIndent(this.elementRef.nativeElement.value).trim();
        }

        if (!this.isBrowser) {
            if (this.pre) return;

            this.pre = this.renderer.createElement('pre');
            this.renderer.addClass(this.pre, 'code');
            this.renderer.addClass(this.pre, 'codeHighlight');
            this.renderer.addClass(this.pre, 'language-' + this.codeHighlight);
            this.renderer.setAttribute(this.pre, 'title', this.title || '');

            this.renderer.insertBefore(
                this.elementRef.nativeElement.parentNode,
                this.pre,
                this.elementRef.nativeElement,
            );
            const text = this.renderer.createText(this.code);
            this.renderer.appendChild(this.pre, text);
            this.renderer.removeChild(this.elementRef.nativeElement.parentNode, this.elementRef.nativeElement);
            return;
        }

        if (!this.pre) {
            if (!this.elementRef.nativeElement.parentNode) return;
            this.pre = this.renderer.createElement('pre');

            this.renderer.addClass(this.pre, 'code');
            this.renderer.addClass(this.pre, 'codeHighlight');
            this.renderer.addClass(this.pre, 'text-selection');
            this.renderer.addClass(this.pre, 'language-' + this.codeHighlight);
            this.renderer.addClass(this.pre, 'overlay-scrollbar-small');
            this.renderer.setAttribute(this.pre, 'title', this.title || '');
            if (this.elementRef.nativeElement instanceof HTMLTextAreaElement) {
                //the textarea is replaced with the pre element
                this.renderer.insertBefore(
                    this.elementRef.nativeElement.parentNode,
                    this.pre,
                    this.elementRef.nativeElement,
                );
                this.renderer.removeChild(this.elementRef.nativeElement.parentNode, this.elementRef.nativeElement);
            } else {
                this.renderer.appendChild(this.elementRef.nativeElement, this.pre);
            }
        }

        if (!this.code) return;

        const lang = this.codeHighlight || 'typescript';
        try {
            const highlighted = highlight(this.code, languages[lang], lang);
            this.pre!.innerHTML = highlighted;
        } catch (error: any) {
            this.pre!.innerHTML = error.message + ': ' + this.code;
        }
    }
}
