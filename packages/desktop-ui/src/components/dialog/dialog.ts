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
    ApplicationRef,
    ChangeDetectorRef,
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Directive,
    ElementRef,
    Inject,
    Injectable,
    Injector,
    Input,
    OnDestroy,
    Type,
    ViewContainerRef
} from '@angular/core';
import { DialogComponent } from './dialog.component.js';
import { isTargetChildOf } from '../../core/utils.js';
import { DuiDialogProgress, ProgressDialogState } from './progress-dialog.component.js';
import { DOCUMENT } from '@angular/common';
import { WindowRegistry } from '../window/window-state.js';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';


@Component({
    template: `
        <h3>{{title || 'No title'}}</h3>
        <div *ngIf="content">{{content}}</div>

        <dui-dialog-actions>
            <dui-button [closeDialog]="false">Cancel</dui-button>
            <dui-button focus [closeDialog]="true">OK</dui-button>
        </dui-dialog-actions>
    `
})
export class DuiDialogConfirm {
    @Input() title: string = 'Confirm';
    @Input() content: string = '';

    static dialogDefaults = {
        maxWidth: '700px'
    };
}

@Component({
    template: `
        <h3>{{title || 'No title'}}</h3>
        <div *ngIf="content" class="text-selection" style="white-space: pre-line;">{{content}}</div>

        <dui-dialog-actions>
            <dui-button focus [closeDialog]="true">OK</dui-button>
        </dui-dialog-actions>
    `
})
export class DuiDialogAlert {
    @Input() title: string = 'Alert';
    @Input() content: string = '';

    static dialogDefaults = {
        maxWidth: '700px'
    };
}

@Component({
    template: `
        <h3>{{title || 'No title'}}</h3>
        <div *ngIf="content" class="text-selection" style="white-space: pre-line;">{{content}}</div>
        <div style="padding-top: 5px;">
            <dui-input style="width: 100%" (enter)="dialog.close(value)" focus [(ngModel)]="value"></dui-input>
        </div>

        <dui-dialog-actions>
            <dui-button [closeDialog]="false">Cancel</dui-button>
            <dui-button [closeDialog]="value">OK</dui-button>
        </dui-dialog-actions>
    `
})
export class DuiDialogPrompt {
    @Input() title: string = 'Alert';
    @Input() content: string = '';

    @Input() value: string = '';

    static dialogDefaults = {
        maxWidth: '700px'
    };

    constructor(public dialog: DialogComponent) {
    }
}

@Injectable()
export class DuiDialog {
    constructor(
        protected resolver: ComponentFactoryResolver,
        protected app: ApplicationRef,
        protected injector: Injector,
        protected registry: WindowRegistry,
        protected overlay: Overlay,
    ) {
    }

    protected getComponentRef(viewContainerRef: ViewContainerRef | null = null): ComponentRef<DialogComponent> {
        if (!viewContainerRef && !this.registry.activeWindow) {
            //create portal
            const overlayRef = this.overlay.create();
            const portal = new ComponentPortal(DialogComponent);

            const comp = overlayRef.attach(portal);
            comp.instance.closed.subscribe((v) => {
                overlayRef.dispose();
            });

            return comp;
        }

        if (!viewContainerRef) {
            viewContainerRef = this.registry.getCurrentViewContainerRef();
        }

        console.log('this.registry.activeWindow', this.registry.activeWindow, viewContainerRef);
        const factory = this.resolver.resolveComponentFactory(DialogComponent);
        return viewContainerRef.createComponent(factory);
    }

    public open<T>(
        component: Type<T>,
        inputs: { [name in keyof T]?: any } = {},
        dialogInputs: { [name: string]: any } = {},
        viewContainerRef: ViewContainerRef | null = null,
    ): { dialog: DialogComponent, close: Promise<any>, component: T } {
        const comp = this.getComponentRef(viewContainerRef);
        comp.instance.visible = true;
        comp.instance.component = component;
        comp.instance.componentInputs = inputs;

        if ((component as any).dialogDefaults) {
            for (const [i, v] of Object.entries((component as any).dialogDefaults)) {
                (comp.instance as any)[i] = v;
            }
        }

        for (const [i, v] of Object.entries(dialogInputs)) {
            (comp.instance as any)[i] = v;
        }

        comp.instance.show();
        comp.changeDetectorRef.detectChanges();

        const close = new Promise((resolve) => {
            comp.instance.closed.subscribe((v) => {
                comp.destroy();
                resolve(v);
            });
        });

        return {
            dialog: comp.instance,
            close,
            component: comp.instance.wrapperComponentRef!.instance!.renderComponentDirective!.component!.instance,
        };
    }

    public async alert(title: string, content?: string, dialodInputs: { [name: string]: any } = {}): Promise<boolean> {
        const { dialog } = this.open(DuiDialogAlert, { title, content }, dialodInputs);
        return dialog.toPromise();
    }

    public async confirm(title: string, content?: string, dialodInputs: { [name: string]: any } = {}): Promise<boolean> {
        const { dialog } = this.open(DuiDialogConfirm, { title, content }, dialodInputs);
        return dialog.toPromise();
    }

    public async prompt(title: string, value: string, content?: string, dialodInputs: { [name: string]: any } = {}): Promise<false | string> {
        const { dialog } = this.open(DuiDialogPrompt, { title, value, content }, dialodInputs);
        return dialog.toPromise();
    }

    public progress(): ProgressDialogState {
        const state$ = new ProgressDialogState;
        this.open(DuiDialogProgress, { state$ });
        return state$;
    }
}

@Directive({
    selector: '[confirm]',
})
export class DuiDialogConfirmDirective implements OnDestroy {
    @Input() confirm!: string;

    ignoreNextClick = false;

    callback = async (event: MouseEvent) => {
        if (isTargetChildOf(event.target, this.element.nativeElement)) {
            if (this.ignoreNextClick) {
                this.ignoreNextClick = false;
                return;
            }

            event.stopPropagation();
            event.preventDefault();
            const [title, text] = this.confirm.split('\n');
            const a = await this.dialog.confirm(title, text, {});
            if (a) {
                this.ignoreNextClick = true;
                this.element.nativeElement.dispatchEvent(event);
            }
            this.cd.detectChanges();
        }
    };

    constructor(
        protected element: ElementRef<HTMLElement>,
        protected dialog: DuiDialog,
        protected cd: ChangeDetectorRef,
        @Inject(DOCUMENT) protected document: any,
    ) {
        this.document.body!.addEventListener('click', this.callback, true);
    }

    ngOnDestroy() {
        this.document.body!.removeEventListener('click', this.callback, true);
    }
}
