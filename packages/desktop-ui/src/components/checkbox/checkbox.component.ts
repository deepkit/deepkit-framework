import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component, DoCheck,
    HostBinding,
    HostListener, Injectable,
    Injector, SkipSelf
} from "@angular/core";
import {ngValueAccessor, ValueAccessorBase} from "../../core/form";

@Component({
    selector: 'dui-checkbox',
    template: `
        <span class="box">
            <dui-icon [size]="12" name="check"></dui-icon>
        </span>
        <ng-content></ng-content>
    `,
    styleUrls: ['./checkbox.component.scss'],
    providers: [ngValueAccessor(CheckboxComponent)],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent extends ValueAccessorBase<any>  {
    @HostBinding('tabindex')
    get tabIndex() {
        return 1;
    }

    @HostBinding('class.checked')
    get isChecked() {
        return true === this.innerValue;
    }

    @HostListener('click')
    public onClick() {
        if (this.isDisabled) return;

        this.touch();
        this.innerValue = !this.innerValue;
    }

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        super(injector, cd, cdParent);
    }

}
