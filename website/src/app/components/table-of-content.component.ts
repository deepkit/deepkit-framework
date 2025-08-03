import { Component, computed, effect, ElementRef, HostListener, inject, Injectable, signal, viewChild } from '@angular/core';
import { createNotifier } from 'ngxtension/create-notifier';
import { RouterLink } from '@angular/router';
import { ContentTextService } from '@app/app/components/content-text.component.js';

type HeaderInfo = { label: string, indent: number, top: number, height: number, link: string };

@Injectable({ providedIn: 'root' })
export class TableOfContentService {
    headers = signal<HeaderInfo[]>([]);
    content = signal<HTMLElement | undefined>(undefined);

    unregister(content: HTMLElement) {
        if (this.content() !== content) return;
        this.content.set(undefined);
        this.headers.set([]);
    }

    render(content: HTMLElement) {
        if ('undefined' === typeof window) return;

        this.content.set(content);
        const headers: HeaderInfo[] = [];
        const viewportHeight = window.innerHeight;
        const rect = content.getBoundingClientRect();
        const headerElements = content.querySelectorAll('h1, h2, h3, h4');

        for (const headerElement of headerElements) {
            const label = headerElement.textContent?.trim() || '';
            const link = headerElement.id || '';
            const indent = headerElement.tagName === 'H2' ? 0 : (headerElement.tagName === 'H3' ? 1 : 2);
            const top = headerElement.getBoundingClientRect().top - rect.top;
            headers.push({ label, indent, top, link, height: 0 });
        }

        // if nothing overflows, we don't need a table of content
        const lastHeader = headers[headers.length - 1];
        if (headers.length === 0 || lastHeader.top < viewportHeight) {
            this.headers.set([]);
            return;
        }

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (i < headers.length - 1) {
                const nextHeader = headers[i + 1];
                header.height = (nextHeader.top - header.top) / rect.height;
            } else {
                header.height = (rect.bottom - header.top) / rect.height;
            }
            header.top = header.top / rect.height;
        }

        this.headers.set(headers);
    }
}

@Component({
    selector: 'app-table-of-content',
    template: `
      <div class="wrapper" #wrapper>
        @if (enabled()) {
          @for (line of lines(); track $index) {
            <div class="line" [style.top.px]="line[2]"
                 [class.active]="$index === activeLine()"></div>
          }

          @let tops = this.headersTop();
          @for (header of toc.headers(); track $index) {
            @let top = tops[$index];
            @if (top >= 0) {
              <a [routerLink]="[]" [fragment]="header.link" class="header"
                 [class.active]="activeHeader() === header.link"
                 [style.top.%]="top * 100">{{ header.label }}</a>
            }
          }
        }
      </div>
    `,
    host: {
        '[class.enabled]': 'enabled()',
    },
    styles: `
      .line {
        position: absolute;
        right: 0;
        width: 10px;
        height: 1px;
        background-color: rgba(192, 192, 192, 0.32);
        transition: 0.1s ease-out;

        &.active {
          background-color: #fff;
          height: 2px;
        }
      }

      .header {
        position: absolute;
        left: 5px;
        right: 15px;
        color: #666;
        margin-top: -14px;
        font-size: 12px;
        line-height: 20px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: 0.1s ease-out;

        &.active {
          color: #fff;
          font-weight: bold;
        }
      }

      .wrapper {
        position: absolute;
        top: 30px;
        right: 0;
        bottom: 30px;
        width: 100%;
      }

      :host {
        font-size: 12px;
        position: fixed;
        z-index: 500;
        top: 60px;
        right: 0;
        bottom: 30px;
        width: calc((100% - 1000px) / 2);
        min-width: calc((100% - 1000px) / 2);
        text-align: right;
        background: rgba(9, 10, 11, 0.93);
        -webkit-backdrop-filter: blur(7px);
        backdrop-filter: blur(7px);
        border-radius: 12px;
        transition: 0.1s ease-out;

        &.enabled:hover {
          min-width: 230px;
        }

        a, a:link {
          display: block;
          padding: 3px 0;

          &:hover {
            color: white;
            text-decoration: none;
          }
        }
      }
    `,
    imports: [
        RouterLink,
    ],
})
export class TableOfContentComponent {
    contentTextService = inject(ContentTextService);
    toc = inject(TableOfContentService);
    interval = 20; //px

    elementRef = viewChild.required('wrapper', { read: ElementRef<HTMLElement> });

    resize = createNotifier();
    activeHeader = signal<string | undefined>(undefined);
    activeLine = signal<number | undefined>(undefined);

    enabled = computed(() => this.contentTextService.tocVisible() && this.toc.headers().length > 0);

    containerHeight = computed(() => {
        this.resize.listen();
        return this.elementRef().nativeElement.getBoundingClientRect?.().height || 0;
    });

    constructor() {
        effect(() => {
            this.lines();
            this.updateActiveHeader();
        });
    }

    @HostListener('window:resize')
    onResize() {
        this.resize.notify();
    }

    @HostListener('window:scroll')
    onScroll() {
        this.updateActiveHeader();
    }

    private updateActiveHeader() {
        const content = this.toc.content();
        if (!content || !content.getBoundingClientRect) return;
        const scrollTop = window.scrollY;
        const rect = content.getBoundingClientRect();
        const contentHeight = rect.height;
        const offsetTop = rect.top + scrollTop;

        const containerHeight = this.containerHeight();
        const scrollPercentage = (scrollTop - offsetTop) / contentHeight;
        const y = scrollPercentage * containerHeight;

        const index = Math.round(y / this.interval);
        this.activeLine.set(index >= 0 ? index : undefined);
        const headers = this.toc.headers();

        for (let i = headers.length - 1; i >= 0; i--) {
            const header = headers[i];
            const absTop = offsetTop + header.top * contentHeight;
            if (scrollTop + this.interval >= absTop) {
                this.activeHeader.set(header.link);
                return;
            }
        }

        this.activeHeader.set(undefined);
    }

    lines = computed(() => {
        const lines: [label: string, url: string, top: number][] = [];
        const containerHeight = this.containerHeight();
        // const containerHeight = headers[headers.length - 1].top + headers[headers.length - 1].height;

        for (let y = 0; y < containerHeight; y += this.interval) {
            const line: [label: string, url: string, top: number] = ['', '', y];
            lines.push(line);
        }
        return lines;
    });

    headersTop = computed(() => {
        const headers = this.toc.headers();
        const headersTop: number[] = Array(headers.length).fill(-1);

        let previousTop = -1;
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const stickyTop = this.protected(header.top);
            if (stickyTop === previousTop) continue; // Skip if the top is the same as the previous one
            headersTop[i] = stickyTop;
            previousTop = stickyTop;
        }

        return headersTop;
    });

    /**
     * We get a number like 0.945 and want to make it sticky to the interval of 20px.
     */
    protected (percentage: number): number {
        const containerHeight = this.containerHeight();
        const top = percentage * containerHeight;
        const stickyTop = Math.round(top / this.interval) * this.interval;
        return stickyTop / containerHeight; // Return as percentage
    }

}
