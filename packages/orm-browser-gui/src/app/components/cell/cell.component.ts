import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Input,
    OnChanges,
    OnDestroy,
    ViewContainerRef
} from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { Registry } from 'src/app/registry';

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
    @Input() property!: PropertySchema;
    @Input() model!: any;

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
        this.componentRef.instance.model = this.model;
        this.componentRef.changeDetectorRef.detectChanges();
    }
}
