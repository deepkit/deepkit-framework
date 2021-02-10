import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Input,
    OnChanges,
    OnInit,
    ViewContainerRef
} from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { isArray } from '@deepkit/core';
import { Registry } from '../../registry';

@Component({
    template: ``,
    styles: [`
        :host ::ng-deep ~ ng-component:not(:last-of-type)::after {
            content: ',';
        }
    `]
})
export class ArrayCellComponent implements OnChanges, OnInit  {
    @Input() model: any;
    @Input() property!: PropertySchema;

    protected componentRefs: ComponentRef<any>[] = [];

    constructor(
        private containerRef: ViewContainerRef,
        private resolver: ComponentFactoryResolver,
        private registry: Registry,
    ) {
    }

    ngOnChanges() {
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    setLabel(): void {
        const subType = this.property.getSubType();

        if (!isArray(this.model)) return;

        for (const ref of this.componentRefs) {
            ref.destroy();
        }

        const component = this.registry.cellComponents[subType.type];
        if (!component) return;
        const componentFactory = this.resolver.resolveComponentFactory(component);

        for (const item of this.model) {
            const componentRef = this.containerRef.createComponent(componentFactory);
            componentRef.instance.property = subType;
            componentRef.instance.model = item;

            this.componentRefs.push(componentRef);
            componentRef.changeDetectorRef.markForCheck();
        }
    }
}
