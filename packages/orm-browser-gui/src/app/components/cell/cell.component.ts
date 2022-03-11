import { Component, ComponentFactoryResolver, ComponentRef, Input, OnChanges, OnDestroy, ViewContainerRef } from '@angular/core';
import { Type } from '@deepkit/type';
import { cellRegistry } from '../../registry';
import { TypeDecoration } from './utils';

@Component({
    selector: 'orm-browser-property-view',
    template: ``,
    styles: [`
        :host {
            display: none;
        }
    `]
})
export class CellComponent implements OnDestroy, OnChanges {
    @Input() type!: Type;
    @Input() model!: any;
    @Input() decoration?: TypeDecoration;

    protected componentRef?: ComponentRef<any>;

    constructor(
        private containerRef: ViewContainerRef,
        private resolver: ComponentFactoryResolver,
    ) {
    }

    ngOnDestroy() {
        this.unlink();
    }

    unlink() {
        this.componentRef?.destroy();
    }

    ngOnChanges() {
        this.link();
    }

    link() {
        const component = cellRegistry.get(this.type);
        if (!component) {
            return;
        }
        this.componentRef?.destroy();

        const componentFactory = this.resolver.resolveComponentFactory(component);
        this.componentRef = this.containerRef.createComponent(componentFactory);
        this.componentRef.instance.type = this.type;
        this.componentRef.instance.decoration = this.decoration;
        this.componentRef.instance.model = this.model;
        this.componentRef.changeDetectorRef.detectChanges();
    }
}
