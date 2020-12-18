import {
    AfterViewInit,
    ApplicationRef,
    ComponentFactoryResolver,
    ComponentRef,
    Directive,
    Input,
    OnDestroy,
    ViewContainerRef
} from "@angular/core";

@Directive({
    selector: '[renderComponent]',
})
export class RenderComponentDirective implements AfterViewInit, OnDestroy {
    @Input() renderComponent: any;
    @Input() renderComponentInputs: { [name: string]: any } = {};

    public component?: ComponentRef<any>;

    constructor(
        protected app: ApplicationRef,
        protected resolver: ComponentFactoryResolver,
        protected viewContainerRef: ViewContainerRef,
    ) {
    }

    ngAfterViewInit(): void {
        const factoryMain = this.resolver.resolveComponentFactory(this.renderComponent);
        const original = (factoryMain.create as any).bind(factoryMain);
        factoryMain.create = (...args: any[]) => {
            const comp = original(...args);

            for (const [i, v] of Object.entries(this.renderComponentInputs)) {
                comp.instance[i] = v;
            }

            return comp;
        };

        this.component = this.viewContainerRef.createComponent(factoryMain, 0, this.viewContainerRef.injector);

        this.app.tick();
    }

    ngOnDestroy(): void {
        if (this.component) {
            this.component.destroy();
        }
    }
}
