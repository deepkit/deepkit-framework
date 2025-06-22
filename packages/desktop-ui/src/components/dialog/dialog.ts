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
  OnDestroy,
  Type,
  ViewContainerRef,
  input
} from '@angular/core';
import { DialogComponent, DialogActionsComponent, CloseDialogDirective } from './dialog.component';
import { isTargetChildOf } from '../../core/utils';
import { DuiDialogProgress, ProgressDialogState } from './progress-dialog.component';
import { DOCUMENT } from '@angular/common';
import { WindowRegistry } from '../window/window-state';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ButtonComponent, HotkeyDirective } from '../button/button.component';
import { InputComponent } from '../input/input.component';
import { FormsModule } from '@angular/forms';


@Component({
    template: `
        <h3>{{title() || 'No title'}}</h3>
        @if (content()) {
          <div>{{content()}}</div>
        }
        
        <dui-dialog-actions>
          <dui-button hotkey="escape" [closeDialog]="false">Cancel</dui-button>
          <dui-button focus [closeDialog]="true">OK</dui-button>
        </dui-dialog-actions>
        `,
    imports: [DialogActionsComponent, ButtonComponent, HotkeyDirective, CloseDialogDirective]
})
export class DuiDialogConfirm {
    title = input<string>('Confirm');
    content = input<string>('');

    static dialogDefaults = {
        maxWidth: '700px'
    };
}

@Component({
    template: `
        <h3>{{title() || 'No title'}}</h3>
        @if (content()) {
          <div class="text-selection" style="white-space: pre-line;">{{content()}}</div>
        }
        
        <dui-dialog-actions>
          <dui-button focus hotkey="escape"  [closeDialog]="true">OK</dui-button>
        </dui-dialog-actions>
        `,
    imports: [DialogActionsComponent, ButtonComponent, HotkeyDirective, CloseDialogDirective]
})
export class DuiDialogAlert {
    title = input<string>('Alert');
    content = input<string>('');

    static dialogDefaults = {
        maxWidth: '700px'
    };
}

@Component({
    template: `
      <h3>{{ title() || 'No title' }}</h3>
      @if (content(); as content) {
        <div class="text-selection" style="white-space: pre-line;">{{ content }}</div>
      }
      <div style="padding-top: 5px;">
        <dui-input style="width: 100%" (enter)="dialog.close(value())" focus [(ngModel)]="value()"></dui-input>
      </div>

      <dui-dialog-actions>
        <dui-button hotkey="escape" [closeDialog]="false">Cancel</dui-button>
        <dui-button [closeDialog]="value()">OK</dui-button>
      </dui-dialog-actions>
    `,
    imports: [InputComponent, FormsModule, DialogActionsComponent, ButtonComponent, HotkeyDirective, CloseDialogDirective]
})
export class DuiDialogPrompt {
    title = input<string>('Alert');
    content = input<string>('');

    value = input<string>('');

    static dialogDefaults = {
        maxWidth: '700px'
    };

    constructor(public dialog: DialogComponent) {
    }
}

@Injectable({ providedIn: 'root' })
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
                comp.destroy();
                overlayRef.dispose();
            });

            return comp;
        }

        if (!viewContainerRef) {
            viewContainerRef = this.registry.getCurrentViewContainerRef();
        }

        const factory = this.resolver.resolveComponentFactory(DialogComponent);
        return viewContainerRef.createComponent(factory);
    }

    public open<T>(
        component: Type<T>,
        inputs: { [name in keyof T]?: any } = {},
        dialogInputs: Partial<DialogComponent> = {},
        viewContainerRef: ViewContainerRef | null = null,
    ): { dialog: DialogComponent, close: Promise<any>, component: T } {
        const comp = this.getComponentRef(viewContainerRef);
        comp.setInput('visible', true);
        comp.setInput('component', component);
        comp.setInput('componentInputs', inputs);

        if ((component as any).dialogDefaults) {
            for (const [i, v] of Object.entries((component as any).dialogDefaults) as Array<[string, any]>) {
                comp.setInput(i, v);
            }
        }

        for (const [i, v] of Object.entries(dialogInputs)) {
            comp.setInput(i, v);
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
            component: comp.instance.wrapperComponentRef?.instance?.renderComponentDirective?.component?.instance,
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

@Directive({ selector: '[confirm]', })
export class DuiDialogConfirmDirective implements OnDestroy {
    confirm = input.required<string>();

    ignoreNextClick = false;

    callback = async (event: MouseEvent) => {
        if (isTargetChildOf(event.target, this.element.nativeElement)) {
            if (this.ignoreNextClick) {
                this.ignoreNextClick = false;
                return;
            }

            event.stopPropagation();
            event.preventDefault();
            const [title, text] = this.confirm().split('\n');
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
