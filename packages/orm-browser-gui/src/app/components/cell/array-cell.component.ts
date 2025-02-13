import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Input,
    OnChanges,
    OnInit,
    ViewContainerRef,
} from '@angular/core';
import { isArray } from '@deepkit/core';
import { TypeArray } from '@deepkit/type';
import { inputRegistry } from '../../registry';

@Component({
    template: ``,
    styles: [`
        :host ::ng-deep ~ ng-component:not(:last-of-type)::after {
            content: ',';
        }
    `],
    standalone: false
})
export class ArrayCellComponent implements OnChanges, OnInit  {
    @Input() model: any;
    @Input() type!: TypeArray;

    protected componentRefs: ComponentRef<any>[] = [];

    constructor(
        private containerRef: ViewContainerRef,
        private resolver: ComponentFactoryResolver
    ) {
    }

    ngOnChanges() {
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    setLabel(): void {
        const subType = this.type.type;

        if (!isArray(this.model)) return;

        for (const ref of this.componentRefs) {
            ref.destroy();
        }

        const component = inputRegistry.get(subType);
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
