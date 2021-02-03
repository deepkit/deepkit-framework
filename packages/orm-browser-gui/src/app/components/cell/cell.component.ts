import { Component, ComponentFactoryResolver, ComponentRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewContainerRef } from "@angular/core";
import { ClassType } from "@deepkit/core";
import { PropertySchema } from "@deepkit/type";
import { Subscription } from "rxjs";
import { DateCellComponent } from "./date-cell.component";
import { StringCellComponent } from "./string-cell.component";

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
    components: { [name: string]: ClassType } = {
        'string': StringCellComponent,
        'number': StringCellComponent,
        'date': DateCellComponent,
    };

    @Input() property!: PropertySchema;
    @Input() row!: any

    @Output() done = new EventEmitter<void>();

    protected componentRef?: ComponentRef<any>;

    constructor(private containerRef: ViewContainerRef, private resolver: ComponentFactoryResolver) {
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
        if (!this.components[this.property.type]) {
            return;
        }
        this.componentRef?.destroy();

        const componentFactory = this.resolver.resolveComponentFactory(this.components[this.property.type]);
        this.componentRef = this.containerRef.createComponent(componentFactory);
        this.componentRef.instance.property = this.property;
        this.componentRef.instance.row = this.row;
    }
}