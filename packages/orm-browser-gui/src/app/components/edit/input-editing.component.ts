import { Component, ComponentFactoryResolver, ComponentRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewContainerRef } from "@angular/core";
import { TableComponent } from "@deepkit/desktop-ui";
import { PropertySchema } from "@deepkit/type";
import { Subscription } from "rxjs";
import { Registry } from "src/app/registry";

@Component({
    selector: 'field-editing',
    template: ``,
    styles: [`
        :host {
            display: none;
        }
    `]
})
export class InputEditing implements OnDestroy, OnChanges {
    @Input() property!: PropertySchema;
    @Input() row!: any

    @Output() done = new EventEmitter<any>();

    protected componentRef?: ComponentRef<any>;
    protected subDone?: Subscription;
    protected subKey?: Subscription;

    constructor(
        private registry: Registry,
        private table: TableComponent<any>,
        private containerRef: ViewContainerRef,
        private resolver: ComponentFactoryResolver,
    ) {
    }

    ngOnDestroy() {
        this.unlink();
    }

    ngOnChanges() {
        this.link();
    }

    protected unlink() {
        this.subDone?.unsubscribe();
        this.subKey?.unsubscribe();
        this.componentRef?.destroy();
    }

    protected link() {
        this.unlink();

        const component = this.registry.inputComponents[this.property.type];
        if (!component) {
            return;
        }

        const componentFactory = this.resolver.resolveComponentFactory(component);
        this.componentRef = this.containerRef.createComponent(componentFactory);
        this.componentRef.instance.property = this.property;
        this.componentRef.instance.row = this.row;
        this.subDone = this.componentRef.instance.done.subscribe(() => {
            if (this.row.$__activeColumn === this.property.name) this.row.$__activeColumn = undefined;
            this.done.emit(this.row);
        });

        this.subKey = this.componentRef.instance.keyDown.subscribe((event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'tab') return;
            event.preventDefault();
            const currentColumn = this.row.$__activeColumn;
            const currentIndex = this.table.sortedColumnDefs.findIndex(v => v.name === currentColumn);

            if (currentIndex >= 0) {
                if (event.shiftKey) {
                    const next = this.table.sortedColumnDefs[currentIndex - 1];
                    if (next) this.row.$__activeColumn = next.name;
                } else {
                    const next = this.table.sortedColumnDefs[currentIndex + 1];
                    if (next) this.row.$__activeColumn = next.name;
                }
            }
        });
    }
}