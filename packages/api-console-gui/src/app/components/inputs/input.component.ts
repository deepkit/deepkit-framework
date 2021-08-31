import {
    AfterViewInit,
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    ViewChild,
    ViewContainerRef
} from '@angular/core';
import { unsubscribe } from '@deepkit/desktop-ui';
import { PropertySchema, Types } from '@deepkit/type';
import { Subscription } from 'rxjs';
import { InputRegistry } from './registry';
import { propertyToTSJSONInterface } from '../../utils';
import { DataStructure } from '../../store';

@Component({
    selector: 'api-console-input',
    template: `
        <div class="decoration" *ngIf="decoration">
            <div class="title">
                <dui-checkbox [ngModel]="enabled"
                              (ngModelChange)="setEnabled($event)"
                              *ngIf="!isValueRequired"
                >{{property.name}}</dui-checkbox>
                <div *ngIf="isValueRequired">{{property.name}}</div>
                <dui-icon class="help-icon" clickable [openDropdown]="helpDropdown" name="help"></dui-icon>
            </div>
            <div class="description" *ngIf="property.description">{{property.description}}</div>
            <ng-container #container></ng-container>
        </div>
        <div *ngIf="!decoration" class="non-decoration">
            <dui-checkbox *ngIf="!isValueRequired"
                          [ngModel]="enabled"
                          (ngModelChange)="setEnabled($event)"></dui-checkbox>
            <ng-container #container></ng-container>

            <dui-icon class="help-icon" style="flex: 0;" clickable [openDropdown]="helpDropdown" name="help"></dui-icon>
        </div>
        <dui-dropdown #helpDropdown>
            <ng-container *dropdownContainer>
                <div class="help-code">
                    <div codeHighlight [code]="propertyName + propertyToTSInterface(property)"></div>
                </div>
            </ng-container>
        </dui-dropdown>
    `,
    styleUrls: ['./input.component.scss']
})
export class InputComponent implements OnDestroy, OnChanges, AfterViewInit {
    propertyToTSInterface = propertyToTSJSONInterface;
    /**
     * Whether name and description is displayed as well, or only the input field.
     */
    @Input() decoration: boolean = false;
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    /**
     * To force a different component input type than the one in property
     */
    @Input() type?: Types;

    @Input() optional?: false;

    protected componentRef?: ComponentRef<any>;

    @unsubscribe()
    protected subKey?: Subscription;

    @unsubscribe()
    protected subChange?: Subscription;

    @ViewChild('container', {read: ViewContainerRef}) container?: ViewContainerRef;

    constructor(
        private registry: InputRegistry,
        private resolver: ComponentFactoryResolver,
    ) {
    }

    get isValueRequired(): boolean {
        return this.optional === undefined ? this.property.isValueRequired : true;
    }

    get propertyName(): string {
        return this.property.name === 'undefined' ? '' : this.property.name + ': ';
    }

    get enabled(): boolean {
        if (!this.decoration) return true;
        if (this.isValueRequired) return true;
        return this.model.active;
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled !== enabled) {
            this.model.active = enabled;
            if (enabled) {
                this.link();
            } else {
                this.unlink();
            }
            this.modelChange.emit(this.model);
        }
    }

    ngOnDestroy() {
        this.unlink();
    }

    ngAfterViewInit(): void {
        this.link();
    }

    ngOnChanges(changes: SimpleChanges) {
        this.link();
    }

    protected unlink() {
        this.subKey?.unsubscribe();
        this.componentRef?.destroy();
    }

    protected link() {
        this.unlink();

        if (!this.enabled) return;
        if (!this.container) return;

        const component = this.registry.inputComponents[this.type || this.property.type];
        if (!component) {
            return;
        }

        const componentFactory = this.resolver.resolveComponentFactory(component);
        this.componentRef = this.container.createComponent(componentFactory);
        this.componentRef.instance.model = this.model;
        this.componentRef.instance.modelChange = this.modelChange;
        this.componentRef.instance.property = this.property;
        this.componentRef.changeDetectorRef.detectChanges();

        if (this.componentRef.instance.keyDown) {
            this.subKey = this.componentRef.instance.keyDown.subscribe((event: KeyboardEvent) => {
                this.keyDown.emit(event);
            });
        }
    }
}
