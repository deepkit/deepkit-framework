import { Component, ComponentFactoryResolver, ComponentRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewContainerRef } from "@angular/core";
import { PropertySchema } from "@deepkit/type";
import { Registry } from "src/app/registry";

@Component({
    selector: 'cell',
    template: ``,
    styles: [`
        :host {
            display: none;
        }
    `]
})
export class CellComponent implements OnDestroy, OnChanges {
    @Input() property!: PropertySchema;
    @Input() row!: any

    @Output() done = new EventEmitter<void>();

    protected componentRef?: ComponentRef<any>;

    constructor(
        private containerRef: ViewContainerRef, 
        private resolver: ComponentFactoryResolver,
        private registry: Registry,
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
        const component = this.registry.cellComponents[this.property.type];
        if (!component) {
            return;
        }
        this.componentRef?.destroy();

        const componentFactory = this.resolver.resolveComponentFactory(component);
        this.componentRef = this.containerRef.createComponent(componentFactory);
        this.componentRef.instance.property = this.property;
        this.componentRef.instance.row = this.row;
        this.componentRef.changeDetectorRef.detectChanges();
    }
}