/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    AfterViewInit,
    ApplicationRef,
    ChangeDetectorRef,
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Directive,
    EventEmitter,
    Inject,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    TemplateRef,
    Type,
    ViewChild,
    ViewContainerRef
} from '@angular/core';
import { ComponentPortal, DomPortalHost, PortalHost } from '@angular/cdk/portal';
import { WindowComponent } from '../window/window.component.js';
import { WindowRegistry } from '../window/window-state.js';
import { RenderComponentDirective } from '../core/render-component.directive.js';
import { ELECTRON_WINDOW, IN_DIALOG } from '../app/token.js';
import { Subscription } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { DuiDialog } from '../dialog/dialog.js';
import { Electron } from '../../core/utils.js';
import { detectChangesNextFrame } from '../app/index.js';

function PopupCenter(url: string, title: string, w: number, h: number): Window {
    let top = window.screenTop + (window.outerHeight / 2) - w / 2;
    top = top > 0 ? top : 0;

    let left = window.screenLeft + (window.outerWidth / 2) - w / 2;
    left = left > 0 ? left : 0;

    const newWindow: Window = window.open(url, title, 'width=' + w + ', height=' + h + ', top=' + top + ', left=' + left)!;

    return newWindow;
}

@Component({
    template: `
        <ng-container *ngIf="component"
                      #renderComponentDirective
                      [renderComponent]="component" [renderComponentInputs]="componentInputs"
        >
        </ng-container>

        <ng-container *ngIf="content" [ngTemplateOutlet]="content"></ng-container>

        <ng-container *ngIf="container">
            <ng-container [ngTemplateOutlet]="container"></ng-container>
        </ng-container>

        <ng-container *ngIf="!container">
            <ng-content></ng-content>
        </ng-container>
    `,
    host: {
        '[attr.tabindex]': '1'
    }
})
export class ExternalDialogWrapperComponent {
    @Input() component?: Type<any>;
    @Input() componentInputs: { [name: string]: any } = {};

    actions?: TemplateRef<any> | undefined;
    container?: TemplateRef<any> | undefined;
    content?: TemplateRef<any> | undefined;

    @ViewChild(RenderComponentDirective, { static: false }) renderComponentDirective?: RenderComponentDirective;

    constructor(
        protected cd: ChangeDetectorRef,
        public injector: Injector,
        @Inject(ELECTRON_WINDOW) electron: any,
    ) {
    }

    public setDialogContainer(container: TemplateRef<any> | undefined) {
        this.container = container;
        this.cd.detectChanges();
    }
}

@Component({
    selector: 'dui-external-dialog',
    template: `
        <ng-template #template>
            <ng-content></ng-content>
        </ng-template>
    `,
})
export class ExternalWindowComponent implements AfterViewInit, OnDestroy, OnChanges {
    private portalHost?: PortalHost;

    @Input() alwaysRaised: boolean = false;

    @Input() visible: boolean = true;
    @Output() visibleChange = new EventEmitter<boolean>();

    @Output() closed = new EventEmitter<void>();

    @Input() component?: Type<any>;
    @Input() componentInputs: { [name: string]: any } = {};

    public wrapperComponentRef?: ComponentRef<ExternalDialogWrapperComponent>;

    @ViewChild('template', { static: false }) template?: TemplateRef<any>;

    externalWindow?: Window;
    container?: TemplateRef<any> | undefined;

    observerStyles?: MutationObserver;
    observerClass?: MutationObserver;

    parentFocusSub?: Subscription;
    electronWindow?: any;
    parentWindow?: WindowComponent;

    constructor(
        protected componentFactoryResolver: ComponentFactoryResolver,
        protected applicationRef: ApplicationRef,
        protected injector: Injector,
        protected dialog: DuiDialog,
        protected registry: WindowRegistry,
        protected cd: ChangeDetectorRef,
        protected viewContainerRef: ViewContainerRef,
    ) {

    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.visible) {
            this.show();
        } else {
            this.close();
        }
    }

    public setDialogContainer(container: TemplateRef<any> | undefined) {
        this.container = container;
        if (this.wrapperComponentRef) {
            this.wrapperComponentRef.instance.setDialogContainer(container);
        }
    }

    public show() {
        if (this.externalWindow) {
            this.electronWindow.focus();
            return;
        }

        this.externalWindow = PopupCenter('', '', 300, 300);

        if (!this.externalWindow) {
            this.dialog.alert('Error', 'Could not open window.');
            return;
        }

        this.externalWindow.onunload = () => {
            this.close();
        };

        const cloned = new Map<Node, Node>();

        for (let i = 0; i < window.document.styleSheets.length; i++) {
            const style = window.document.styleSheets[i];
            if (!style.ownerNode) continue;
            const clone: Node = style.ownerNode.cloneNode(true);
            cloned.set(style.ownerNode, clone);
            this.externalWindow!.document.head!.appendChild(clone);
        }

        this.observerStyles = new MutationObserver((mutations: MutationRecord[]) => {
            for (const mutation of mutations) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (!cloned.has(node)) {
                        const clone: Node = node.cloneNode(true);
                        cloned.set(node, clone);
                        this.externalWindow!.document.head!.appendChild(clone);
                    }
                }

                for (let i = 0; i < mutation.removedNodes.length; i++) {
                    const node = mutation.removedNodes[i];
                    if (cloned.has(node)) {
                        const clone = cloned.get(node)!;
                        clone.parentNode!.removeChild(clone);
                        cloned.delete(node);
                    }
                }
            }
        });

        this.observerStyles.observe(window.document.head!, {
            childList: true,
        });

        const copyBodyClass = () => {
            if (this.externalWindow) {
                this.externalWindow.document.body.className = window.document.body.className;
            }
        };


        this.observerClass = new MutationObserver((mutations: MutationRecord[]) => {
            copyBodyClass();
        });

        this.observerClass.observe(window.document.body, {
            attributeFilter: ['class']
        });
        const document = this.externalWindow!.document;

        copyBodyClass();

        this.electronWindow = Electron.isAvailable() ? Electron.getRemote().BrowserWindow.getAllWindows()[0] : undefined;
        this.parentWindow = this.registry.getOuterActiveWindow();

        if (this.parentWindow && this.alwaysRaised) {
            this.parentWindow.windowState.disableInputs.next(true);
            if (this.parentWindow.electronWindow) {
                this.electronWindow.setParentWindow(this.parentWindow.electronWindow);
            }
        }

        window.addEventListener('beforeunload', () => {
            this.beforeUnload();
        });

        this.portalHost = new DomPortalHost(
            document.body,
            this.componentFactoryResolver,
            this.applicationRef,
            this.injector
        );

        document.addEventListener('click', () => detectChangesNextFrame());
        document.addEventListener('focus', () => detectChangesNextFrame());
        document.addEventListener('blur', () => detectChangesNextFrame());
        document.addEventListener('keydown', () => detectChangesNextFrame());
        document.addEventListener('keyup', () => detectChangesNextFrame());
        document.addEventListener('keypress', () => detectChangesNextFrame());
        document.addEventListener('mousedown', () => detectChangesNextFrame());

        //todo, add beforeclose event and call beforeUnload() to make sure all dialogs are closed when page is reloaded

        const injector = Injector.create({
            parent: this.injector,
            providers: [
                { provide: ExternalWindowComponent, useValue: this },
                { provide: ELECTRON_WINDOW, useValue: this.electronWindow },
                { provide: IN_DIALOG, useValue: false },
                { provide: DOCUMENT, useValue: this.externalWindow!.document },
            ],
        });

        const portal = new ComponentPortal(ExternalDialogWrapperComponent, this.viewContainerRef, injector);

        this.wrapperComponentRef = this.portalHost.attach(portal);

        this.wrapperComponentRef!.instance.component = this.component!;
        this.wrapperComponentRef!.instance.componentInputs = this.componentInputs;
        this.wrapperComponentRef!.instance.content = this.template!;

        if (this.container) {
            this.wrapperComponentRef!.instance.setDialogContainer(this.container);
        }

        this.visible = true;
        this.visibleChange.emit(true);

        this.wrapperComponentRef!.changeDetectorRef.detectChanges();
        this.wrapperComponentRef!.location.nativeElement.focus();

        this.cd.detectChanges();
    }

    beforeUnload() {
        if (this.externalWindow) {
            if (this.portalHost) {
                this.portalHost.detach();
                this.portalHost.dispose();
                delete this.portalHost;
            }
            this.closed.emit();
            if (this.parentFocusSub) this.parentFocusSub.unsubscribe();

            if (this.parentWindow && this.alwaysRaised) {
                this.parentWindow.windowState.disableInputs.next(false);
            }
            if (this.externalWindow) {
                this.externalWindow!.close();
            }

            delete this.externalWindow;
            this.observerStyles!.disconnect();
            this.observerClass!.disconnect();
        }
    }

    ngAfterViewInit() {
    }

    public close() {
        this.visible = false;
        this.visibleChange.emit(false);
        this.beforeUnload();
        requestAnimationFrame(() => {
            this.applicationRef.tick();
        });
    }

    ngOnDestroy(): void {
        this.beforeUnload();
    }
}


/**
 * This directive is necessary if you want to load and render the dialog content
 * only when opening the dialog. Without it it is immediately render, which can cause
 * performance and injection issues.
 */
@Directive({
    'selector': '[externalDialogContainer]',
})
export class ExternalDialogDirective {
    constructor(protected dialog: ExternalWindowComponent, public template: TemplateRef<any>) {
        this.dialog.setDialogContainer(this.template);
    }
}
