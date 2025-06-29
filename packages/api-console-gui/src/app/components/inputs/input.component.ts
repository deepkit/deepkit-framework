import { ApplicationRef, Component, ComponentRef, effect, EventEmitter, inject, Injector, input, inputBinding, model, OnDestroy, Output, twoWayBinding, viewChild, ViewContainerRef } from '@angular/core';
import { CheckboxComponent, DropdownComponent, DropdownContainerDirective, IconComponent, OpenDropdownDirective, unsubscribe } from '@deepkit/desktop-ui';
import { hasDefaultValue, isOptional, ReflectionKind, Type } from '@deepkit/type';
import { Subscription } from 'rxjs';
import type { DataStructure } from '../../store';
import { TypeDecoration, typeToTSJSONInterface } from '../../utils';
import { InputRegistry } from './registry';
import { FormsModule } from '@angular/forms';
import { CodeHighlightComponent } from '@deepkit/ui-library';

@Component({
    selector: 'api-console-input',
    template: `
      @if (decoration(); as decoration) {
        <div class="decoration">
          <div class="title">
            @if (!isValueRequired) {
              <dui-checkbox [ngModel]="enabled"
                            (ngModelChange)="setEnabled($event)"
              >{{ String(decoration.name) }}
              </dui-checkbox>
            }
            @if (isValueRequired) {
              <div>{{ String(decoration.name) }}</div>
            }
            <dui-icon class="help-icon" clickable [openDropdown]="helpDropdown" name="help"></dui-icon>
          </div>
          @if (decoration.description) {
            <div class="description">{{ decoration.description }}</div>
          }
          <div #container></div>
        </div>
      } @else {
        <div class="non-decoration">
          @if (!isValueRequired) {
            <dui-checkbox
              [ngModel]="enabled"
              (ngModelChange)="setEnabled($event)"></dui-checkbox>
          }
          <div #container></div>
          <dui-icon class="help-icon" style="flex: 0;" clickable [openDropdown]="helpDropdown" name="help"></dui-icon>
        </div>
      }
      <dui-dropdown #helpDropdown>
        <ng-container *dropdownContainer>
          <div class="help-code">
            <code-highlight [code]="typeToTSJSONInterface(type())"></code-highlight>
          </div>
        </ng-container>
      </dui-dropdown>
    `,
    styleUrls: ['./input.component.scss'],
    imports: [
        CheckboxComponent,
        FormsModule,
        IconComponent,
        OpenDropdownDirective,
        DropdownComponent,
        CodeHighlightComponent,
        DropdownContainerDirective,
    ],
})
export class InputComponent implements OnDestroy {
    typeToTSJSONInterface = typeToTSJSONInterface;
    /**
     * Whether name and description is displayed as well, or only the input field.
     */
    decoration = input<TypeDecoration>();
    model = model.required<DataStructure>();

    type = input.required<Type>();

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    optional = input<false>();

    inputRegistry = inject(InputRegistry);

    protected componentRef?: ComponentRef<any>;

    @unsubscribe()
    protected subKey?: Subscription;

    @unsubscribe()
    protected subChange?: Subscription;

    applicationRef = inject(ApplicationRef);
    injector = inject(Injector);

    container = viewChild('container', { read: ViewContainerRef });

    constructor() {
        effect(() => this.link());
    }

    get isValueRequired(): boolean {
        const type = this.type();
        return !isOptional(type) && !hasDefaultValue(type);
    }

    get enabled(): boolean {
        if (!this.decoration()) return true;
        if (this.isValueRequired) return true;
        return this.model().active();
    }

    setEnabled(enabled: boolean): void {
        console.log('setEnabled', enabled, this.enabled, this.model().active());
        if (this.enabled !== enabled) {
            this.model().active.set(enabled);
            if (enabled) {
                this.link();
            } else {
                this.unlink();
            }
        }
    }

    ngOnDestroy() {
        this.unlink();
    }

    protected unlink() {
        this.subKey?.unsubscribe();
        this.componentRef?.destroy();
    }

    protected link() {
        this.unlink();

        if (!this.enabled) return;
        const container = this.container();
        if (!container) return;
        this.model(); // subscribe

        const typeValue = this.type();
        const type = typeValue.kind === ReflectionKind.propertySignature || typeValue.kind === ReflectionKind.property ? typeValue.type : typeValue;
        const component = this.inputRegistry.registry.get(type);
        if (!component) {
            console.log('no component for', type);
            return;
        }

        this.componentRef = container.createComponent(component, {
            injector: this.injector,
            bindings: [
                twoWayBinding('model', this.model),
                inputBinding('decoration', this.decoration),
                inputBinding('type', () => type),
            ],
        });

        if (this.componentRef.instance.keyDown) {
            this.subKey = this.componentRef.instance.keyDown.subscribe((event: KeyboardEvent) => {
                this.keyDown.emit(event);
            });
        }
    }

    protected readonly String = String;
}
