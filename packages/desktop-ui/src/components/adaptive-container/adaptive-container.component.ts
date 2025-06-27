import { AfterViewInit, Component, computed, contentChild, Directive, effect, ElementRef, input, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { injectElementRef } from '../app/utils';
import { ButtonComponent } from '../button/button.component';
import { DropdownComponent, DropdownContainerDirective } from '../button/dropdown.component';
import { NgTemplateOutlet } from '@angular/common';

interface ElementWithVisibility {
    node: Element;
    visible: boolean;
}

@Directive({
    selector: '[duiPlaceElements]',
    standalone: true,
})
export class PlaceElements implements OnDestroy {
    duiPlaceElements = input.required<Element[]>();
    protected host = injectElementRef();

    protected placedElements = new Set<Element>();
    protected oldParent?: HTMLElement;

    constructor() {
        effect(() => this.place());
    }

    protected place() {
        const elements = this.duiPlaceElements();
        const parent = this.host.nativeElement;
        if (!parent) return;

        for (const element of elements) {
            if (this.placedElements.has(element)) continue;
            if (!this.oldParent && element.parentElement) this.oldParent = element.parentElement;
            this.placedElements.add(element);
            parent.appendChild(element);
            element.classList.remove('dui-ac-hidden');
        }

        // Remove elements that are no longer in the list
        for (const child of this.placedElements) {
            if (!elements.includes(child)) {
                child.classList.add('dui-ac-hidden');
                this.placedElements.delete(child);
                if (this.oldParent) {
                    this.oldParent.appendChild(child);
                }
            }
        }
    }

    ngOnDestroy() {
        for (const element of this.placedElements) {
            element.classList.add('dui-ac-hidden');
            if (this.oldParent) {
                this.oldParent.appendChild(element);
            }
        }
    }
}

/**
 * The AdaptiveContainerComponent is a flexible container that arranges its child elements
 * in a row or column, depending on the specified direction. It uses flexbox to manage the layout
 * and automatically hides elements that overflow the container's bounds.
 *
 * You should set always an appropriate height.
 *
 * For direction=row, you might want to set the height of the container to the maximum height of the children.
 *
 * For direction=column, you might want to set the height to 100% or a fixed height and
 * children should have a fixed width or a width of 100%.
 *
 * ```html
 * <dui-adaptive-container>
 *     <dui-button>Button 1</dui-button>
 *     <dui-button>Button 2</dui-button>
 *     <dui-button>Button 3</dui-button>
 *     <dui-button>Button 4</dui-button>
 * </dui-adaptive-container>
 * ```
 */
@Component({
    selector: 'dui-adaptive-container',
    host: {
        ngSkipHydration: 'true',
        '[class.row]': 'direction() === "row"',
        '[class.column]': 'direction() === "column"',
        '[class.row-reverse]': 'direction() === "row-reverse"',
        '[class.column-reverse]': 'direction() === "column-reverse"',
        '[style.padding]': 'element() ? undefined : elementPadding()',
        '[class.has-hidden]': 'hiddenElements().length > 0',
    },
    template: `
      <ng-content></ng-content>
      <div #toggleButtonContainer class="toggle-button">
        @if (!contentDropdownComponent()) {
          <dui-dropdown class="dropdownClass()">
            <div class="dui-dropdown-content" *dropdownContainer [duiPlaceElements]="hiddenElements()"></div>
          </dui-dropdown>
        }
        @if (effectiveButtonTemplate(); as template) {
          <ng-container *ngTemplateOutlet="template; context: { $implicit: this }"></ng-container>
        } @else {
          <dui-button textured (click)="toggleDropdown($event)" icon="arrow"></dui-button>
        }
      </div>
    `,
    styleUrl: './adaptive-container.component.scss',
    imports: [
        ButtonComponent,
        DropdownComponent,
        PlaceElements,
        DropdownContainerDirective,
        NgTemplateOutlet,
    ],
})
export class AdaptiveContainerComponent implements OnInit, AfterViewInit {
    protected host = injectElementRef();
    protected toggleButtonContainer = viewChild('toggleButtonContainer', { read: ElementRef });
    protected contentDropdownComponent = contentChild(DropdownComponent);
    protected viewDropdownComponent = viewChild(DropdownComponent);

    dropdown = computed(() => this.viewDropdownComponent() || this.contentDropdownComponent());

    /**
     * Per default, the dui-adaptive-container will be made adaptive. Pass an Element or ElementRef to
     * use a different element as the container.
     */
    element = input<Element | ElementRef>();

    /**
     * The class to apply to the dropdown container.
     */
    dropdownClass = input('');

    direction = input<'row' | 'column' | 'row-reverse' | 'column-reverse'>('row');

    buttonTemplate = input<TemplateRef<any>>();

    protected registeredButtonTemplate = signal<TemplateRef<any> | undefined>(undefined);

    protected effectiveButtonTemplate = computed(() => this.buttonTemplate() || this.registeredButtonTemplate());

    protected effectiveElement = computed<HTMLElement>(() => {
        const element = this.element();
        return element instanceof ElementRef ? element.nativeElement : element || this.host.nativeElement;
    });

    protected update = signal(0);

    protected vertical = computed(() => this.direction() === 'column' || this.direction() === 'column-reverse');

    elementPadding = computed(() => {
        if (this.hiddenElements().length < 1) return undefined;
        const toggleButton = this.toggleButtonContainer()?.nativeElement;
        // Ensure the toggle button is not considered part of the adaptive container
        return toggleButton ? getPadding(toggleButton.getBoundingClientRect(), this.direction()) : undefined;
    });

    protected nodes = computed(() => {
        this.update();
        const element = this.effectiveElement();
        if (!element.getBoundingClientRect) return [];

        const nodes: Element[] = [];
        for (const node of element.childNodes) {
            if (!(node instanceof Element)) continue;
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                continue; // Skip invisible elements
            }
            nodes.push(node);
        }
        return nodes;
    });

    protected dominatingElement = computed(() => {
        const nodes = this.nodes();
        const vertical = this.vertical();

        let firstElement: DOMRect | undefined;
        for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            if (!firstElement) {
                firstElement = rect;
                continue;
            }
            if (vertical) {
                if (rect.left < firstElement.left) {
                    firstElement = rect; // Find the leftmost element
                }
            } else {
                if (rect.top < firstElement.top) {
                    firstElement = rect; // Find the topmost element
                }
            }
        }

        if (!firstElement) return;

        // We have to determine the element that acts as threshold to determine what other elements have been wrapped.
        // if horizontal, this is the first row
        let dominatingElement: DOMRect = firstElement;

        for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            if (vertical) {
                if (rect.left >= dominatingElement.width + dominatingElement.left) {
                    // The first element that is wrapped
                    break;
                }
                if (rect.left + rect.width > dominatingElement.left + dominatingElement.width) {
                    // New dominating element
                    dominatingElement = rect;
                }
            } else {
                if (rect.top >= dominatingElement.height + dominatingElement.top) {
                    // The first element that is wrapped
                    break;
                }
                if (rect.top + rect.height > dominatingElement.top + dominatingElement.height) {
                    // New dominating element
                    dominatingElement = rect;
                }
            }
        }
        return dominatingElement;
    });

    elements = computed(() => {
        const dominatingElement = this.dominatingElement();
        if (!dominatingElement) return [];
        const nodes = this.nodes();
        const vertical = this.vertical();

        const elements: ElementWithVisibility[] = [];
        for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            if (vertical) {
                const visible = rect.left <= dominatingElement.left;
                elements.push({ node, visible });
            } else {
                const visible = rect.top <= dominatingElement.top;
                elements.push({ node, visible });
            }
        }

        return elements;
    });

    hiddenElements = computed(() => this.elements().filter(e => !e.visible).map(v => v.node));

    constructor() {
        if ('undefined' !== typeof ResizeObserver) {
            let lastObserver: ResizeObserver | undefined;
            effect(() => {
                if (lastObserver) {
                    lastObserver.disconnect();
                    lastObserver = undefined;
                }
                lastObserver = new ResizeObserver(() => {
                    this.update.update(v => v + 1);
                });
                lastObserver.observe(this.effectiveElement());
            });
        }

        effect(() => {
            const elements = this.elements();
            for (const element of elements) {
                if (element.visible) {
                    element.node.classList.remove('dui-ac-hidden');
                } else {
                    element.node.classList.add('dui-ac-hidden');
                }
            }
        });
    }

    toggleDropdown(target: Parameters<DropdownComponent['toggle']>[0]) {
        const dropdown = this.contentDropdownComponent() || this.viewDropdownComponent();
        if (!dropdown) return;
        dropdown.toggle(target);
    }

    ngOnInit() {
        // this.update.update(v => v + 1);
    }

    ngAfterViewInit() {
        this.update.update(v => v + 1);
    }

    registerButtonTemplate(template: TemplateRef<any>) {
        this.registeredButtonTemplate.set(template);
    }

    unregisterButtonTemplate(template: TemplateRef<any>) {
        if (this.registeredButtonTemplate() === template) {
            this.registeredButtonTemplate.set(undefined);
        }
    }
}

/**
 * Directive to register a template for the adaptive container button.
 *
 * ```html
 * <dui-adaptive-container>
 *   <dui-button>Button 1</dui-button>
 *   <dui-button>Button 2</dui-button>
 *   <dui-button *duiAdaptiveContainerButton (click)="container.toggleDropdown($event.target)">OPEN</dui-button>
 * </dui-adaptive-container>
 * ```
 */
@Directive({
    selector: '[duiAdaptiveContainerButton]',
})
export class DuiAdaptiveContainerButton implements OnDestroy {
    constructor(private container: AdaptiveContainerComponent, public template: TemplateRef<any>) {
        this.container.registerButtonTemplate(this.template);
    }

    ngOnDestroy() {
        this.container.unregisterButtonTemplate(this.template);
    }
}

export function getPadding(rect: DOMRect, direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'): string {
    switch (direction) {
        case 'row':
            return `0 ${rect.width}px 0 0`;
        case 'column':
            return `0 0 ${rect.height}px 0`;
        case 'row-reverse':
            return `0 0 0 ${rect.width}px`;
        case 'column-reverse':
            return `${rect.height}px 0 0 0`;
    }
}
