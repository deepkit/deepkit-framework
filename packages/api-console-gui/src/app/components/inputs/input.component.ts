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
    ViewContainerRef,
} from '@angular/core';
import { unsubscribe } from '@deepkit/desktop-ui';
import { hasDefaultValue, isOptional, ReflectionKind, Type } from '@deepkit/type';
import { Subscription } from 'rxjs';
import { DataStructure } from '../../store';
import { TypeDecoration, typeToTSJSONInterface } from '../../utils';
import { inputRegistry } from './registry';

@Component({
    selector: 'api-console-input',
    template: `
      <div class="decoration" *ngIf="decoration">
        <div class="title">
          <dui-checkbox [ngModel]="enabled"
                        (ngModelChange)="setEnabled($event)"
                        *ngIf="!isValueRequired"
          >{{ decoration.name }}
          </dui-checkbox>
          <div *ngIf="isValueRequired">{{ decoration.name }}</div>
          <dui-icon class="help-icon" clickable [openDropdown]="helpDropdown" name="help"></dui-icon>
        </div>
        <div class="description" *ngIf="decoration.description">{{ decoration.description }}</div>
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
            <code-highlight [code]="typeToTSJSONInterface(type)"></code-highlight>
          </div>
        </ng-container>
      </dui-dropdown>
    `,
    styleUrls: ['./input.component.scss'],
    standalone: false
})
export class InputComponent implements OnDestroy, OnChanges, AfterViewInit {
    typeToTSJSONInterface = typeToTSJSONInterface;
    /**
     * Whether name and description is displayed as well, or only the input field.
     */
    @Input() decoration?: TypeDecoration;
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() type!: Type;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    @Input() optional?: false;

    protected componentRef?: ComponentRef<any>;

    @unsubscribe()
    protected subKey?: Subscription;

    @unsubscribe()
    protected subChange?: Subscription;

    @ViewChild('container', { read: ViewContainerRef }) container?: ViewContainerRef;

    constructor(
        private resolver: ComponentFactoryResolver,
    ) {
    }

    get isValueRequired(): boolean {
        return !isOptional(this.type) && !hasDefaultValue(this.type);
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

        const type = this.type.kind === ReflectionKind.propertySignature || this.type.kind === ReflectionKind.property ? this.type.type : this.type;
        const component = inputRegistry.get(type);
        if (!component) {
            console.log('no component for', type);
            return;
        }

        const componentFactory = this.resolver.resolveComponentFactory(component);
        this.componentRef = this.container.createComponent(componentFactory);
        this.componentRef.instance.model = this.model;
        this.componentRef.instance.modelChange = this.modelChange;
        this.componentRef.instance.decoration = this.decoration;
        this.componentRef.instance.type = type;
        this.componentRef.changeDetectorRef.detectChanges();

        if (this.componentRef.instance.keyDown) {
            this.subKey = this.componentRef.instance.keyDown.subscribe((event: KeyboardEvent) => {
                this.keyDown.emit(event);
            });
        }
    }
}
