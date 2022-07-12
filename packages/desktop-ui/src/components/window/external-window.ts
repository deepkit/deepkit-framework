/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ApplicationRef, ComponentFactoryResolver, Injectable, Injector, Type, ViewContainerRef } from '@angular/core';
import { ExternalWindowComponent } from './external-window.component.js';
import { ComponentPortal, DomPortalHost } from '@angular/cdk/portal';

@Injectable()
export class DuiExternalWindow {
    constructor(
        protected resolver: ComponentFactoryResolver,
        protected app: ApplicationRef,
        protected injector: Injector,
    ) {

    }

    public open<T>(
        component: Type<T>,
        inputs: { [name: string]: any } = {},
        options: {
            alwaysRaised?: boolean,
        } = {},
        viewContainerRef: ViewContainerRef | null = null,
    ): { window: ExternalWindowComponent, instance: T } {
        const portalHost = new DomPortalHost(
            document.body,
            this.resolver,
            this.app,
            this.injector
        );

        //todo, get viewContainerRef from WindowRegistry?
        const portal = new ComponentPortal(ExternalWindowComponent, viewContainerRef, viewContainerRef ? viewContainerRef.injector : null);

        const comp = portalHost.attach(portal);

        if (options && options.alwaysRaised) {
            comp.instance.alwaysRaised = true;
        }
        comp.instance.component = component;
        comp.instance.componentInputs = inputs;

        comp.instance.show();
        comp.changeDetectorRef.detectChanges();

        comp.instance.closed.subscribe(() => {
            comp.destroy();
        });

        return {
            window: comp.instance,
            instance: comp.instance.wrapperComponentRef!.instance!.renderComponentDirective!.component!.instance,
        };
    }

}
