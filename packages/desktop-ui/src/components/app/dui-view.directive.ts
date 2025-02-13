/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Directive, EmbeddedViewRef, Injectable, Input, OnDestroy, TemplateRef, ViewContainerRef } from '@angular/core';
import { detectChangesNextFrame, scheduleWindowResizeEvent } from './utils';

let i = 0;

let currentViewDirective: ViewDirective | undefined;

@Injectable()
export class ViewState {
    public id = i++;

    public viewDirective?: ViewDirective = currentViewDirective;

    get attached() {
        return this.viewDirective ? this.viewDirective.isVisible() : true;
    }
}

@Directive({
    selector: '[duiView]',
    standalone: false,
    providers: [{ provide: ViewState, useClass: ViewState }]
})
export class ViewDirective implements OnDestroy {
    protected view?: EmbeddedViewRef<any>;

    protected visible = false;

    public readonly parentViewDirective: ViewDirective | undefined;

    constructor(
        protected template: TemplateRef<any>,
        protected viewContainer: ViewContainerRef,
    ) {
        this.parentViewDirective = currentViewDirective;
    }

    public isVisible() {
        if (this.view) {
            for (const node of this.view.rootNodes) {
                if (node.style && node.offsetParent !== null) {
                    return true;
                }
            }

            return false;
        }

        return this.visible;
    }

    @Input()
    set duiView(v: boolean) {
        if (this.visible === v) return;

        this.visible = v;

        if (this.visible) {
            if (this.view) {
                this.view.rootNodes.map(element => {
                    if (element.style) {
                        element.style.display = '';
                    }
                });
                this.view!.reattach();
                this.view.markForCheck();
                scheduleWindowResizeEvent();
                return;
            }

            const old = currentViewDirective;
            currentViewDirective = this;
            this.view = this.viewContainer.createEmbeddedView(this.template);
            currentViewDirective = old;
        } else {
            if (this.view) {
                this.view!.rootNodes.map(element => {
                    if (element.style) {
                        element.style.display = 'none';
                    }
                });
                //let the last change detection run so ViewState have correct state
                this.view!.detectChanges();
                this.view!.detach();
                this.view.markForCheck();
                detectChangesNextFrame(this.view);
            }
        }
    }

    ngOnDestroy() {
        if (this.view) {
            this.view.destroy();
        }
    }
}
