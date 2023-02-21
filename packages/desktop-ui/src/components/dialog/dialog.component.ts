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
    ComponentRef,
    Directive, ElementRef,
    EventEmitter,
    HostListener,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    Optional,
    Output,
    SimpleChanges,
    SkipSelf,
    TemplateRef,
    Type,
    ViewChild,
    ViewContainerRef
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { WindowRegistry } from '../window/window-state.js';
import { WindowComponent } from '../window/window.component.js';
import { RenderComponentDirective } from '../core/render-component.directive.js';
import { IN_DIALOG } from '../app/token.js';
import { OverlayStack, OverlayStackItem, ReactiveChangeDetectionModule, unsubscribe } from '../app.js';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '../button.js';

@Component({
    template: `
        <dui-window>
            <dui-window-content class="{{class}}">
                <ng-container *ngIf="component"
                              #renderComponentDirective
                              [renderComponent]="component" [renderComponentInputs]="componentInputs">
                </ng-container>

                <ng-container *ngIf="content" [ngTemplateOutlet]="content"></ng-container>

                <ng-container *ngIf="container">
                    <ng-container [ngTemplateOutlet]="container"></ng-container>
                </ng-container>

                <ng-container *ngIf="!container">
                    <ng-content></ng-content>
                </ng-container>
            </dui-window-content>

            <div class="dialog-actions" *ngIf="actions">
                <ng-container [ngTemplateOutlet]="actions"></ng-container>
            </div>
        </dui-window>
    `,
    host: {
        '[attr.tabindex]': '1'
    },
    styleUrls: ['./dialog-wrapper.component.scss']
})
export class DialogWrapperComponent {
    @Input() component?: Type<any>;
    @Input() componentInputs: { [name: string]: any } = {};

    actions?: TemplateRef<any> | undefined;
    container?: TemplateRef<any> | undefined;
    content?: TemplateRef<any> | undefined;
    class: string = '';

    @ViewChild(RenderComponentDirective, { static: false }) renderComponentDirective?: RenderComponentDirective;

    constructor(
        protected cd: ChangeDetectorRef,
    ) {
    }

    public setActions(actions: TemplateRef<any> | undefined) {
        this.actions = actions;
        this.cd.detectChanges();
    }

    public setDialogContainer(container: TemplateRef<any> | undefined) {
        this.container = container;
        this.cd.detectChanges();
    }
}

@Component({
    selector: 'dui-dialog',
    template: `
        <ng-template #template>
            <ng-content></ng-content>
        </ng-template>`,
    styles: [`:host {
        display: none;
    }`]
})
export class DialogComponent implements AfterViewInit, OnDestroy, OnChanges {
    @Input() title: string = '';

    @Input() visible: boolean = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    @Input() class: string = '';

    @Input() noPadding: boolean | '' = false;

    @Input() minWidth?: number | string;
    @Input() minHeight?: number | string;

    @Input() width?: number | string;
    @Input() height?: number | string;

    @Input() maxWidth?: number | string;
    @Input() maxHeight?: number | string;

    @Input() center: boolean = false;

    @Input() backDropCloses: boolean = false;

    @Input() component?: Type<any>;
    @Input() componentInputs: { [name: string]: any } = {};

    @Output() closed = new EventEmitter<any>();
    @Output() open = new EventEmitter<any>();

    @ViewChild('template', { static: true }) template?: TemplateRef<any>;

    actions?: TemplateRef<any> | undefined;
    container?: TemplateRef<any> | undefined;

    public overlayRef?: OverlayRef;
    public wrapperComponentRef?: ComponentRef<DialogWrapperComponent>;

    protected lastOverlayStackItem?: OverlayStackItem;

    constructor(
        protected applicationRef: ApplicationRef,
        protected overlayStack: OverlayStack,
        protected viewContainerRef: ViewContainerRef,
        protected cd: ChangeDetectorRef,
        protected overlay: Overlay,
        protected injector: Injector,
        protected registry: WindowRegistry,
        @Optional() @SkipSelf() protected cdParent?: ChangeDetectorRef,
        @Optional() protected window?: WindowComponent,
    ) {
    }

    public toPromise(): Promise<any> {
        return new Promise((resolve) => {
            this.closed.subscribe((v: any) => {
                resolve(v);
            });
        });
    }

    public setDialogContainer(container: TemplateRef<any> | undefined) {
        this.container = container;
        if (this.wrapperComponentRef) {
            this.wrapperComponentRef.instance.setDialogContainer(container);
        }
    }

    public setActions(actions: TemplateRef<any> | undefined) {
        this.actions = actions;
        if (this.wrapperComponentRef) {
            this.wrapperComponentRef.instance.setActions(actions);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.visible) {
            this.show();
        } else {
            this.close(undefined);
        }
    }

    public show() {
        if (this.overlayRef) {
            return;
        }

        const window = this.window ? this.window.getClosestNonDialogWindow() : this.registry.getOuterActiveWindow();
        const offsetTop = window && window.header ? window.header.getBottomPosition() : 0;

        // const document = this.registry.getCurrentViewContainerRef().element.nativeElement.ownerDocument;

        //this is necessary for multi-window environments, but doesn't work yet.
        // const overlayContainer = new OverlayContainer(document);
        //
        // const overlay = new Overlay(
        //     this.injector.get(ScrollStrategyOptions),
        //     overlayContainer,
        //     this.injector.get(ComponentFactoryResolver),
        //     new OverlayPositionBuilder(this.injector.get(ViewportRuler), document, this.injector.get(Platform), overlayContainer),
        //     this.injector.get(OverlayKeyboardDispatcher),
        //     this.injector,
        //     this.injector.get(NgZone),
        //     document,
        //     this.injector.get(Directionality),
        // );
        const overlay = this.overlay;

        let positionStrategy = overlay
            .position()
            .global().centerHorizontally().top(offsetTop + 'px');

        if (this.center) {
            positionStrategy = overlay
                .position()
                .global().centerHorizontally().centerVertically();
        }

        this.overlayRef = overlay.create({
            width: this.width || undefined,
            height: this.height || undefined,
            minWidth: this.minWidth || undefined,
            minHeight: this.minHeight || undefined,
            maxWidth: this.maxWidth || '90%',
            maxHeight: this.maxHeight || '90%',
            hasBackdrop: true,
            panelClass: [this.class, (this.center ? 'dialog-overlay' : 'dialog-overlay-with-animation'), this.noPadding !== false ? 'dialog-overlay-no-padding' : ''],
            scrollStrategy: overlay.scrollStrategies.reposition(),
            positionStrategy: positionStrategy,
        });

        if (this.backDropCloses) {
            this.overlayRef!.backdropClick().subscribe(() => {
                this.close(undefined);
            });
        }
        const injector = Injector.create({
            parent: this.injector,
            providers: [
                { provide: DialogComponent, useValue: this },
                { provide: WindowComponent, useValue: window },
                { provide: IN_DIALOG, useValue: true },
            ],
        });

        this.open.emit();
        const portal = new ComponentPortal(DialogWrapperComponent, this.viewContainerRef, injector);

        this.wrapperComponentRef = this.overlayRef!.attach(portal);
        this.wrapperComponentRef.instance.component = this.component!;
        this.wrapperComponentRef.instance.componentInputs = this.componentInputs;
        this.wrapperComponentRef.instance.content = this.template!;
        this.wrapperComponentRef.instance.class = this.class!;

        if (this.lastOverlayStackItem) this.lastOverlayStackItem.release();
        this.lastOverlayStackItem = this.overlayStack.register(this.overlayRef.hostElement);

        if (this.actions) {
            this.wrapperComponentRef!.instance.setActions(this.actions);
        }

        if (this.container) {
            this.wrapperComponentRef!.instance.setDialogContainer(this.container);
        }

        this.overlayRef!.updatePosition();

        this.visible = true;
        this.visibleChange.emit(true);

        this.wrapperComponentRef!.location.nativeElement.focus();
        this.wrapperComponentRef!.changeDetectorRef.detectChanges();

        this.cd.detectChanges();
        if (this.cdParent) this.cdParent.detectChanges();
    }

    protected beforeUnload() {
        if (this.lastOverlayStackItem) this.lastOverlayStackItem.release();

        if (this.overlayRef) {
            this.overlayRef.dispose();
            this.overlayRef = undefined;
        }
    }

    ngAfterViewInit() {
    }

    public close(v?: any) {
        this.beforeUnload();
        this.visible = false;
        this.visibleChange.emit(false);

        this.closed.emit(v);
        ReactiveChangeDetectionModule.tick();
    }

    ngOnDestroy(): void {
        this.beforeUnload();
    }
}

/**
 * This directive is necessary if you want to load and render the dialog content
 * only when opening the dialog. Without it, it is immediately rendered, which can cause
 * performance and injection issues.
 */
@Directive({
    'selector': '[dialogContainer]',
})
export class DialogDirective {
    constructor(protected dialog: DialogComponent, public template: TemplateRef<any>) {
        this.dialog.setDialogContainer(this.template);
    }
}

@Component({
    selector: 'dui-dialog-actions',
    template: '<ng-template #template><ng-content></ng-content></ng-template>'
})
export class DialogActionsComponent implements AfterViewInit, OnDestroy {
    @ViewChild('template', { static: true }) template!: TemplateRef<any>;

    constructor(protected dialog: DialogComponent) {
    }

    ngAfterViewInit(): void {
        this.dialog.setActions(this.template);
    }

    ngOnDestroy(): void {
        if (this.dialog.actions === this.template) {
            this.dialog.setActions(undefined);
        }
    }
}

@Component({
    selector: 'dui-dialog-error',
    template: '<ng-content></ng-content>',
    styleUrls: ['./dialog-error.component.scss']
})
export class DialogErrorComponent {
}


@Directive({
    selector: '[closeDialog]'
})
export class CloseDialogDirective {
    @Input() closeDialog: any;

    constructor(protected dialog: DialogComponent) {
    }

    @HostListener('click')
    onClick() {
        this.dialog.close(this.closeDialog);
    }
}

/**
 * A directive to open the given dialog on regular left click.
 */
@Directive({
    'selector': '[openDialog]',
})
export class OpenDialogDirective implements AfterViewInit, OnChanges, OnDestroy {
    @Input() openDialog?: DialogComponent;

    @unsubscribe()
    openSub?: Subscription;

    @unsubscribe()
    hiddenSub?: Subscription;

    constructor(
        protected elementRef: ElementRef,
        @Optional() protected button?: ButtonComponent,
    ) {
    }

    ngOnDestroy() {
    }

    ngOnChanges() {
        this.link();
    }

    ngAfterViewInit() {
        this.link();
    }

    protected link() {
        if (this.button && this.openDialog) {
            this.openSub = this.openDialog.open.subscribe(() => {
                if (this.button) this.button.active = true;
            });
            this.hiddenSub = this.openDialog.closed.subscribe(() => {
                if (this.button) this.button.active = false;
            });
        }
    }

    @HostListener('click')
    onClick() {
        if (this.openDialog) this.openDialog.show();
    }
}
