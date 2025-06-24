/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AfterViewInit, ComponentRef, Directive, input, OnDestroy, ViewContainerRef } from '@angular/core';

@Directive({ selector: '[renderComponent]' })
export class RenderComponentDirective implements AfterViewInit, OnDestroy {
    renderComponent = input<any>();
    renderComponentInputs = input<{
        [name: string]: any;
    }>({});

    public component?: ComponentRef<any>;

    constructor(
        protected viewContainerRef: ViewContainerRef,
    ) {
    }

    ngAfterViewInit(): void {
        this.component = this.viewContainerRef.createComponent(this.renderComponent());

        for (const [i, v] of Object.entries(this.renderComponentInputs())) {
            this.component.setInput(i, v);
        }
    }

    ngOnDestroy(): void {
        if (this.component) {
            this.component.destroy();
        }
    }
}
