import { NgForOf, NgIf } from '@angular/common';
import {
    ApplicationRef,
    Component,
    EnvironmentInjector,
    Input,
    OnChanges,
    OnInit,
    Renderer2,
    ViewContainerRef,
    createComponent,
    reflectComponentType,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { HighlightCodeComponent } from '@app/app/components/highlight-code.component';
import { ImageComponent } from '@app/app/components/image.component';
import { AppImagesComponent } from '@app/app/components/images.component';
import { ScreenComponent, ScreensComponent } from '@app/app/components/screens.component';
import { Content } from '@app/common/models';

const whitelist = [
    'div',
    'p',
    'a',
    'button',
    'iframe',
    'pre',
    'span',
    'code',
    'strong',
    'hr',
    'ul',
    'li',
    'ol',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'img',
    'table',
    'tbody',
    'tr',
    'td',
    'th',
    'boxes',
    'box',
];

@Component({
    standalone: true,
    selector: 'box',
    host: {
        '[class.app-box]': 'true',
    },
    template: `
        <div class="title">{{ title }}</div>
        <ng-content></ng-content>
    `,
})
export class ContentRenderBox {
    @Input() title: string = '';
}

@Component({
    standalone: true,
    selector: 'codebox',
    styles: [
        `
            iframe {
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 2px;
                width: 100%;
                height: 600px;
            }
        `,
    ],
    template: ` <iframe [src]="srcAllowed" allowfullscreen></iframe> `,
})
export class ContentCodeBox implements OnInit {
    @Input() src: string = '';

    srcAllowed: any;

    constructor(private sanitizer: DomSanitizer) {}

    ngOnInit() {
        this.srcAllowed = this.sanitizer.bypassSecurityTrustResourceUrl(this.src);
    }
}

@Component({
    standalone: true,
    selector: 'feature',
    host: {
        '[class.app-feature]': 'true',
    },
    styles: [
        `
            :host {
                display: flex;
                align-items: center;
                margin: 200px 0;
                text-align: justify;
            }

            .text {
                flex: 1;
                margin-right: 55px;
                max-width: 480px;

                ::ng-deep {
                    h2,
                    h3 {
                        text-align: left;
                    }
                }
            }

            .code {
                flex: 1;
            }

            :host.right {
                flex-direction: row-reverse;

                .text {
                    margin: auto;
                    margin-left: 55px;
                }
            }

            :host.center {
                display: block;
                text-align: center;

                .text {
                    margin: auto;
                    max-width: 680px;
                }

                ::ng-deep {
                    h2,
                    h3 {
                        text-align: center;
                    }
                }

                .code {
                    display: grid;
                    grid-gap: 45px;
                    grid-auto-columns: auto;
                    grid-auto-rows: 1fr;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                }
            }

            @media (max-width: 800px) {
                :host {
                    display: block;

                    .text {
                        margin: 0 !important;
                    }
                }
            }
        `,
    ],
    template: `
        <div class="text">
            <ng-content></ng-content>
        </div>
        <div class="code">
            <ng-content select="highlight-code"></ng-content>
        </div>
    `,
})
export class ContentRenderFeature {}

type ContentCreated = { hostView?: any; type?: any; node: Node };

@Component({
    selector: 'app-render-content',
    standalone: true,
    imports: [
        NgForOf,
        NgIf,
        ScreensComponent,
        ScreenComponent,
        HighlightCodeComponent,
        ContentRenderBox,
        ContentRenderFeature,
    ],
    styles: [
        `
            :host {
                display: inline;
            }
        `,
    ],
    template: ``,
})
export class ContentRenderComponent implements OnInit, OnChanges {
    @Input() content!: (Content | string)[] | Content | string;
    @Input() linkRelativeTo: string = '';

    constructor(
        private viewRef: ViewContainerRef,
        private renderer: Renderer2,
        private router: Router,
        private injector: EnvironmentInjector,
        private app: ApplicationRef,
    ) {}

    ngOnChanges() {
        this.render();
    }

    ngOnInit() {
        // console.log('ContentRenderComponent onInit');
        // this.render();
    }

    render() {
        const childNodes = this.viewRef.element.nativeElement.childNodes;
        for (let i = childNodes.length; i > 0; i--) {
            this.renderer.removeChild(this.viewRef.element.nativeElement, childNodes[i - 1]);
        }

        const children = this.renderContent(this.injector, this.content);
        for (const child of children) this.renderer.appendChild(this.viewRef.element.nativeElement, child.node);
    }

    renderContent(injector: EnvironmentInjector, content: (Content | string)[] | Content | string): ContentCreated[] {
        const components: { [name: string]: any } = {
            'app-screens': ScreensComponent,
            'app-screen': ScreenComponent,
            'highlight-code': HighlightCodeComponent,
            box: ContentRenderBox,
            'app-images': AppImagesComponent,
            'app-image': ImageComponent,
            feature: ContentRenderFeature,
            codebox: ContentCodeBox,
        };

        if ('string' === typeof content) {
            const element = this.renderer.createText(content);
            return [{ node: element }];
        } else if (Array.isArray(content)) {
            const children: ContentCreated[] = [];
            for (const child of content) {
                children.push(...this.renderContent(injector, child));
            }
            return children;
        } else if (components[content.tag]) {
            // const container = this.renderer.createElement('div');
            const children: ContentCreated[] = content.children
                ? this.renderContent(this.injector, content.children)
                : [];

            const type = reflectComponentType(components[content.tag]);
            if (!type) return [];

            const projectableNodes: Node[][] = [];
            for (const ngContent of type.ngContentSelectors) {
                const nodes: Node[] = [];
                for (const child of children) {
                    if (child.node instanceof Text && ngContent === '*') {
                        nodes.push(child.node);
                    } else if (child.node instanceof HTMLElement && child.node.matches(ngContent)) {
                        nodes.push(child.node);
                    }
                }
                projectableNodes.push(nodes);
            }

            const component = createComponent(components[content.tag], {
                environmentInjector: this.injector,
                projectableNodes,
            });

            Object.assign(component.instance as any, content.props || {});

            if (content.props && content.props.class) {
                this.renderer.setAttribute(component.location.nativeElement, 'class', content.props.class);
            }

            if (type.ngContentSelectors.length === 0) {
                const lView = (component.hostView as any)._lView;
                const tView = lView[1];
                let tNode = lView[12][6];
                const queries = tView.queries;
                // console.log('lView', lView);
                for (const child of children) {
                    if (child.hostView) {
                        const clView = (child.hostView as any)._lView;
                        lView[1].data.push(child.type);

                        // query.element check uses directiveStart and directiveEnd
                        // and iterates over all lView[i] where directiveStart <= i < directiveEnd.
                        // so we need to update these values every time we add a new directive
                        lView[1].firstChild.directiveEnd++;
                        lView[1].firstChild.providerIndexes = lView.length;
                        lView.push(clView[8]);

                        if (queries) {
                            for (const query of queries.queries) {
                                query.elementStart(tView, tNode);
                            }
                        }
                    }
                }
            }

            this.app.attachView(component.hostView);
            component.changeDetectorRef.detectChanges();

            return [{ hostView: component.hostView, type, node: component.location.nativeElement }];
        } else {
            if (
                content.tag === 'pre' &&
                content.children &&
                content.props &&
                typeof content.props.class === 'string' &&
                content.props.class.startsWith('language-')
            ) {
                const component = createComponent(HighlightCodeComponent, { environmentInjector: this.injector });
                component.instance.lang = content.props.class.substr('language-'.length);
                component.instance.code = content.children[0] as string;

                const params = new URLSearchParams(content.props.meta || '');
                component.instance.meta = Object.fromEntries(params.entries());

                this.app.attachView(component.hostView);
                component.changeDetectorRef.detectChanges();
                return [{ node: component.location.nativeElement }];
            }

            // filter forbidden or dangerous tags. we use a whitelist
            if (!whitelist.includes(content.tag)) {
                return [];
            }

            //what else could be dangerous?
            // <a href="javascript:alert('XSS')">XSS</a>
            // <a href="jAvAsCrIpT:alert('XSS')">XSS</a>
            // <a href="jav&#x09;ascript:alert('XSS')">XSS</a>
            // fix these
            if (content.tag === 'a' && content.props?.href?.toLowerCase().startsWith('javascript:')) {
                return [];
            }

            let element: Node = this.renderer.createElement(content.tag);
            if (content.props) {
                const whitelist = ['href', 'target', 'class', 'id', 'src', 'width', 'height', 'name'];
                for (const [key, value] of Object.entries(content.props)) {
                    if (!whitelist.includes(key)) continue;
                    this.renderer.setAttribute(element, key, value);
                }
            }

            if (content.tag === 'a') {
                //if content.props.href is relative
                // resolve correctly so that ../ and ./ are handled correctly
                if (content.props?.href) {
                    if (content.props.href.startsWith('http://') || content.props.href.startsWith('https://')) {
                        this.renderer.setAttribute(element, 'target', '_blank');
                    } else {
                        const base = new URL('http://none/' + (this.linkRelativeTo || this.router.url));
                        const url = new URL(content.props.href, new URL(this.linkRelativeTo || this.router.url, base));
                        let href = url.pathname.replace('.md', '');
                        if (url.hash) href += url.hash;
                        this.renderer.setAttribute(element, 'href', href);
                    }
                }
            }
            if (content.tag === 'p' || content.tag === 'div') {
                this.renderer.addClass(element, 'text');
            }

            // if (content.tag.startsWith('h') && content.props && content.props.id) {
            //     const a = this.renderer.createElement('a');
            //     this.renderer.setAttribute(a, 'name', content.props.id);
            //     this.renderer.appendChild(parent, a);
            // }

            if (content.tag === 'img') {
                const wrapperDiv = this.renderer.createElement('div');
                this.renderer.addClass(wrapperDiv, 'image');
                this.renderer.appendChild(wrapperDiv, element);
                element = wrapperDiv;
            } else if (content.tag === 'video') {
                this.renderer.removeAttribute(element, 'width');
                this.renderer.removeAttribute(element, 'height');
                this.renderer.setAttribute(element, 'autoplay', '');
                this.renderer.setAttribute(element, 'controls', '');
                this.renderer.setAttribute(element, 'loop', '');
                this.renderer.setAttribute(element, 'playsinline', '');
                this.renderer.setAttribute(element, 'muted', '');

                const videoDiv = this.renderer.createElement('div');
                this.renderer.addClass(videoDiv, 'video');

                const wrapperDiv = this.renderer.createElement('div');
                this.renderer.addClass(wrapperDiv, 'wrapper');
                this.renderer.appendChild(videoDiv, wrapperDiv);

                this.renderer.appendChild(wrapperDiv, element);
                element = videoDiv;
            }
            if (content.children) {
                const children = this.renderContent(injector, content.children);
                for (const child of children) {
                    this.renderer.appendChild(element, child.node);
                }
            }

            return [{ node: element }];
        }
    }
}
