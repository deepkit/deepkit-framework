/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    AfterViewInit,
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    Directive,
    ElementRef,
    EmbeddedViewRef,
    HostListener,
    inject,
    Injector,
    input,
    OnChanges,
    OnDestroy,
    Optional,
    output,
    OutputRefSubscription,
    signal,
    SimpleChanges,
    TemplateRef,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';
import { ConnectedPosition, Overlay, OverlayConfig, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { focusWatcher } from '../../core/utils';
import { isArray } from '@deepkit/core';
import { ButtonComponent } from './button.component';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { OverlayStack, OverlayStackItem } from '../app/app';
import { unsubscribe } from '../app/reactivate-change-detection';
import { WindowComponent } from '../window/window.component';

/**
 * A dropdown component that can be used to display a list of items or content in a popup.
 *
 * It can be opened and closed programmatically or via user interaction.
 *
 * By monitoring the focused elements, it is possible to add interactive elements inside the dropdown.
 */
@Component({
    selector: 'dui-dropdown',
    template: `
      <ng-template #dropdownTemplate>
        <div class="dui-body dui-dropdown"
             [class.dui-normalized]="windowComponent?.normalizeStyle()"
             tabindex="1" #dropdown>
          <div class="content" [class.overlay-scrollbar-small]="scrollbars()">
            @if (container(); as container) {
              <ng-container [ngTemplateOutlet]="container"></ng-container>
            } @else {
              <ng-content></ng-content>
            }
          </div>
        </div>
      </ng-template>
    `,
    host: {
        '[class.overlay]': 'overlay()',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ['./dropdown.component.scss'],
    imports: [NgTemplateOutlet],
})
export class DropdownComponent implements OnChanges, OnDestroy, AfterViewInit {
    isOpen = signal(false);

    overlayRef?: OverlayRef;

    protected portalViewRef?: EmbeddedViewRef<any>;
    protected lastFocusWatcher?: ReturnType<typeof focusWatcher>;

    /**
     * If open() is called without a target, the host element is used as the target.
     * THe target elements is allowed to have focus without closing the dropdown.
     */
    host = input<Element | ElementRef>();

    /**
     * Additional elements that are allowed to have focus without closing the dropdown.
     */
    allowedFocus = input<(Element | ElementRef)[] | (Element | ElementRef)>([]);

    /**
     * Keeps the dropdown open when it should be closed, ideal for debugging purposes.
     */
    keepOpen = input<boolean>();

    height = input<number | string>();

    width = input<number | string>();

    minWidth = input<number | string>();

    minHeight = input<number | string>();

    maxWidth = input<number | string>();

    maxHeight = input<number | string>();

    /**
     * Whether the dropdown should allow scrollbars.
     */
    scrollbars = input<boolean>(true);

    /**
     * Whether the dropdown aligns to the horizontal center.
     */
    center = input<boolean>(false);

    /**
     * Whether is styled as overlay
     */
    overlay = input(false, { transform: booleanAttribute });

    show = input<boolean>();

    /**
     * Additional positions to connect the dropdown to the target element.
     */
    connectedPositions = input<ConnectedPosition[]>([]);

    /**
     * Triggered when the dropdown is opened or closed.
     */
    showChange = output<boolean>();

    /**
     * Triggered when the dropdown is opened.
     */
    shown = output();

    /**
     * Triggered when the dropdown is closed.
     */
    hidden = output();

    @ViewChild('dropdownTemplate', {
        static: false,
        read: TemplateRef,
    }) dropdownTemplate?: TemplateRef<any>;
    @ViewChild('dropdown', { static: false, read: ElementRef }) protected dropdown?: ElementRef<HTMLElement>;

    protected container = signal<TemplateRef<any> | undefined>(undefined);

    protected relativeToInitiator?: HTMLElement;

    protected lastOverlayStackItem?: OverlayStackItem;
    protected positionStrategy?: PositionStrategy;
    protected templatePortal?: TemplatePortal;

    protected windowComponent = inject(WindowComponent, { optional: true });

    constructor(
        protected overlayService: Overlay,
        protected injector: Injector,
        protected overlayStack: OverlayStack,
        protected viewContainerRef: ViewContainerRef,
    ) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.show && this.dropdownTemplate) {
            const show = this.show();
            if (show === true) this.open();
            if (show === false) this.close();
        }
    }

    ngAfterViewInit() {
        if (!this.dropdownTemplate) return;
        this.templatePortal = new TemplatePortal(this.dropdownTemplate, this.viewContainerRef);
        const show = this.show();
        if (show === true) this.open();
        if (show === false) this.close();
    }

    ngOnDestroy(): void {
        this.close();
        this.lastFocusWatcher?.();
    }

    @HostListener('window:keyup', ['$event'])
    protected key(event: KeyboardEvent) {
        if (!this.keepOpen() && this.isOpen() && event.key.toLowerCase() === 'escape' && this.lastOverlayStackItem && this.lastOverlayStackItem.isLast()) {
            this.close();
        }
    }

    /**
     * Toggles the dropdown open or closed.
     */
    toggle(target?: HTMLElement | ElementRef | MouseEvent) {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open(target);
        }
    }

    /**
     * Sets the container template for the dropdown.
     */
    setContainer(container: TemplateRef<any> | undefined) {
        this.container.set(container);
    }

    /**
     * Opens the dropdown at the given target element or mouse position.
     */
    open(target?: Element | ElementRef | MouseEvent | 'center', initiator?: HTMLElement | ElementRef | {
        x: number,
        y: number,
        width: number,
        height: number
    }) {
        if (this.isOpen()) return;
        this.lastFocusWatcher?.();
        if (this.positionStrategy) {
            this.positionStrategy.dispose();
        }
        if (!this.templatePortal) return;

        if (!target) {
            target = this.host();
        }

        target = target instanceof ElementRef ? target.nativeElement : target;

        if (!target) {
            throw new Error('No target or host specified for dropdown');
        }

        //this is necessary for multi-window environments, but doesn't work yet.
        // const document = this.registry.getCurrentViewContainerRef().element.nativeElement.ownerDocument;
        // const overlayContainer = new OverlayContainer(document);
        // const overlayContainer = new OverlayContainer(document);
        // const overlay = new Overlay(
        //     this.injector.get(ScrollStrategyOptions),
        //     overlayContainer,
        //     this.injector.get(ComponentFactoryResolver),
        //     new OverlayPositionBuilder(this.injector.get(ViewportRuler), document, this.injector.get(Platform), overlayContainer),
        //     this.injector.get(OverlayKeyboardDispatcher),
        //     this.injector,
        //     this.injector.get(NgZone),
        //     document,
        //     this.injector.get(Directionality),
        // );
        if (target instanceof MouseEvent) {
            const mousePosition = { x: target.pageX, y: target.pageY };
            this.positionStrategy = this.overlayService
                .position()
                .flexibleConnectedTo(mousePosition)
                .withFlexibleDimensions(false)
                .withViewportMargin(12)
                .withPush(true)
                .withDefaultOffsetY(this.overlay() !== false ? 15 : 0)
                .withPositions([
                    ...this.connectedPositions(),
                    {
                        originX: 'start',
                        originY: 'bottom',
                        overlayX: 'start',
                        overlayY: 'top',
                    },
                    {
                        originX: 'end',
                        originY: 'bottom',
                        overlayX: 'end',
                        overlayY: 'top',
                    },
                    {
                        originX: 'start',
                        originY: 'top',
                        overlayX: 'start',
                        overlayY: 'bottom',
                    },
                    {
                        originX: 'end',
                        originY: 'top',
                        overlayX: 'end',
                        overlayY: 'bottom',
                    },
                ]);
        } else if (target === 'center') {
            this.positionStrategy = this.overlayService
                .position()
                .global().centerHorizontally().centerVertically();
        } else {
            this.positionStrategy = this.overlayService
                .position()
                .flexibleConnectedTo(target)
                .withFlexibleDimensions(false)
                .withViewportMargin(12)
                .withPush(true)
                .withDefaultOffsetY(this.overlay() !== false ? 15 : 0)
                .withPositions([
                    ...this.connectedPositions(),
                    {
                        originX: this.center() ? 'center' : 'start',
                        originY: 'bottom',
                        overlayX: this.center() ? 'center' : 'start',
                        overlayY: 'top',
                    },
                    {
                        originX: 'start',
                        originY: 'bottom',
                        overlayX: 'start',
                        overlayY: 'top',
                    },
                    {
                        originX: 'end',
                        originY: 'bottom',
                        overlayX: 'end',
                        overlayY: 'top',
                    },
                ]);
        }

        if (this.overlayRef) {
            this.overlayRef.updatePositionStrategy(this.positionStrategy);
            this.overlayRef.updatePosition();
        } else {
            this.isOpen.set(true);
            const options: OverlayConfig = {
                minWidth: 50,
                maxWidth: 450,
                maxHeight: '90%',
                hasBackdrop: false,
                scrollStrategy: this.overlayService.scrollStrategies.reposition(),
                positionStrategy: this.positionStrategy,
            };

            const width = this.width();
            if (width) options.width = width;
            const height = this.height();
            if (height) options.height = height;
            const minWidth = this.minWidth();
            if (minWidth) options.minWidth = minWidth;
            const minHeight = this.minHeight();
            if (minHeight) options.minHeight = minHeight;
            const maxWidth = this.maxWidth();
            if (maxWidth) options.maxWidth = maxWidth;
            const maxHeight = this.maxHeight();
            if (maxHeight) options.maxHeight = maxHeight;

            this.overlayRef = this.overlayService.create(options);

            if (this.portalViewRef) this.portalViewRef.destroy();
            this.portalViewRef = this.overlayRef.attach(this.templatePortal);

            this.overlayRef.updatePosition();
            this.shown.emit();
            this.showChange.emit(true);
            // console.log('this.overlayRef', initiator, this.overlayRef.overlayElement);
            this.setInitiator(initiator);
            if (this.relativeToInitiator) {
                const overlayElement = this.overlayRef.overlayElement;
                const rect = this.getInitiatorRelativeRect();
                overlayElement.style.transformOrigin = '0 0';
                overlayElement.style.transform = `translate(${rect.x}px, ${rect.y}px) scale(${rect.width}, ${rect.height})`;

                setTimeout(() => {
                    overlayElement.style.transition = `transform 0.1s ease-in`;
                    overlayElement.style.transform = `translate(0, 0) scale(1, 1)`;
                }, 1);
            }

            setTimeout(() => {
                if (this.overlayRef) this.overlayRef.updatePosition();
            }, 0);

            setTimeout(() => {
                if (this.overlayRef) this.overlayRef.updatePosition();
            }, 50);

            if (this.lastOverlayStackItem) this.lastOverlayStackItem.release();
            this.lastOverlayStackItem = this.overlayStack.register(this.overlayRef.hostElement);
        }

        const allowedFocusValue = this.allowedFocus();
        const normalizedAllowedFocus = isArray(allowedFocusValue) ? allowedFocusValue : (allowedFocusValue ? [allowedFocusValue] : []);
        const allowedFocus = normalizedAllowedFocus.map(v => v instanceof ElementRef ? v.nativeElement : v) as Element[];
        allowedFocus.push(this.overlayRef.hostElement);

        if (target instanceof ElementRef) allowedFocus.push(this.overlayRef.hostElement);
        if (target instanceof Element) allowedFocus.push(target);
        if (target instanceof MouseEvent && target.target instanceof Element) allowedFocus.push(target.target);

        if (this.show() === undefined) {
            this.overlayRef.hostElement.focus();
            this.lastFocusWatcher = focusWatcher(
                this.overlayRef.overlayElement,
                allowedFocus,
                () => {
                    if (!this.keepOpen()) {
                        this.close();
                    }
                },
                (element) => {
                    // If the element is a dialog as well, we don't close
                    if (!element) return false;

                    if (this.lastOverlayStackItem) {
                        // When there's an overlay above ours we keep it open
                        if (!this.lastOverlayStackItem.isLast()) return true;
                    }

                    return false;
                });
        }
    }

    setInitiator(initiator?: HTMLElement | ElementRef | { x: number, y: number, width: number, height: number }) {
        if (!this.overlayRef) return;

        initiator = initiator instanceof ElementRef ? initiator.nativeElement : initiator;
        initiator = initiator instanceof HTMLElement ? initiator : undefined;
        this.relativeToInitiator = initiator;
    }

    protected getInitiatorRelativeRect() {
        const initiator = this.relativeToInitiator?.getBoundingClientRect();
        if (!this.overlayRef || !initiator) return { x: 0, y: 0, width: 1, height: 1 };
        const overlayElement = this.overlayRef.overlayElement;
        const overlayRect = overlayElement.getBoundingClientRect();
        return {
            x: initiator.x - overlayRect.x,
            y: initiator.y - overlayRect.y,
            width: initiator.width / overlayRect.width,
            height: initiator.height / overlayRect.height,
        };
    }

    /**
     * Focuses the dropdown element.
     */
    focus() {
        if (!this.dropdown) return;
        this.dropdown.nativeElement.focus();
    }

    /**
     * Closes the dropdown if it is open.
     */
    close() {
        this.lastFocusWatcher?.();
        if (!this.isOpen()) return;
        if (this.lastOverlayStackItem) {
            this.lastOverlayStackItem.release();
            this.lastOverlayStackItem = undefined;
        }
        this.isOpen.set(false);

        if (this.relativeToInitiator && this.overlayRef) {
            const overlayElement = this.overlayRef.overlayElement;
            const rect = this.getInitiatorRelativeRect();
            overlayElement.style.transition = `transform 0.1s ease-out`;
            overlayElement.style.transform = `translate(${rect.x}px, ${rect.y}px) scale(${rect.width}, ${rect.height})`;
            this.relativeToInitiator = undefined;

            const transitionEnd = () => {
                this.hidden.emit();
                this.showChange.emit(false);
                if (this.overlayRef) {
                    this.portalViewRef?.detach();
                    this.portalViewRef?.destroy();
                    this.overlayRef.detach();
                    this.overlayRef.dispose();
                    this.overlayRef = undefined;
                }
                if (this.positionStrategy) this.positionStrategy.dispose();
                overlayElement.removeEventListener('transitionend', transitionEnd);
            };

            overlayElement.addEventListener('transitionend', transitionEnd, { once: true });
        } else {
            this.hidden.emit();
            this.showChange.emit(false);
            if (this.overlayRef) {
                this.portalViewRef?.detach();
                this.portalViewRef?.destroy();
                this.overlayRef.detach();
                this.overlayRef.dispose();
                this.overlayRef = undefined;
            }
            if (this.positionStrategy) this.positionStrategy.dispose();
        }
    }
}

/**
 * A directive to open the given dropdown on regular left click.
 *
 * ```html
 * <dui-dropdown #dropdown>
 * </dui-dropdown>
 * <dui-button [openDropdown]="dropdown">Open dropdown</dui-button>
 * ```
 */
@Directive({ selector: '[openDropdown]' })
export class OpenDropdownDirective implements AfterViewInit, OnDestroy {
    openDropdown = input<DropdownComponent>();

    @unsubscribe()
    openSub?: OutputRefSubscription;

    @unsubscribe()
    hiddenSub?: OutputRefSubscription;

    constructor(
        protected elementRef: ElementRef,
        @Optional() protected button?: ButtonComponent,
    ) {
    }

    ngOnDestroy() {
    }

    ngAfterViewInit() {
        const openDropdown = this.openDropdown();
        if (this.button && openDropdown) {
            this.openSub = openDropdown.shown.subscribe(() => {
                if (this.button) this.button.active.set(true);
            });
            this.hiddenSub = openDropdown.hidden.subscribe(() => {
                if (this.button) this.button.active.set(false);
            });
        }
    }

    @HostListener('click')
    protected onClick() {
        const openDropdown = this.openDropdown();
        if (openDropdown) {
            openDropdown.toggle(this.elementRef);
        }
    }
}

/**
 * A directive to open the given dropdown on mouseenter, and closes automatically on mouseleave.
 * Dropdown keeps open when mouse enters the dropdown.
 *
 * ```html
 * <dui-dropdown #dropdown>
 * </dui-dropdown>
 * <dui-button [openDropdownHover]="dropdown">Open on hover</dui-button>
 * ```
 */
@Directive({ selector: '[openDropdownHover]' })
export class OpenDropdownHoverDirective implements OnDestroy {
    openDropdownHover = input<DropdownComponent>();

    /**
     * In milliseconds.
     */
    openDropdownHoverCloseTimeout = input<number>(80);

    @unsubscribe()
    protected hiddenSub?: OutputRefSubscription;

    protected lastHide?: ReturnType<typeof setTimeout>;

    protected enter = () => this.onHover();
    protected leave = () => this.onLeave();

    constructor(
        protected elementRef: ElementRef,
    ) {
    }

    ngOnDestroy() {
        this.cleanup();
    }

    protected cleanup() {
        clearTimeout(this.lastHide);
        this.lastHide = undefined;
        this.hiddenSub?.unsubscribe();
    }

    @HostListener('mouseenter')
    protected onHover() {
        this.cleanup();

        const openDropdownHover = this.openDropdownHover();
        if (openDropdownHover && !openDropdownHover.isOpen()) {
            openDropdownHover.open(this.elementRef);
            const overlayRef = openDropdownHover.overlayRef;
            if (overlayRef) {
                overlayRef.hostElement.addEventListener('mouseenter', this.enter);
                overlayRef.hostElement.addEventListener('mouseleave', this.leave);
                this.hiddenSub = openDropdownHover.hidden.subscribe(() => {
                    overlayRef.hostElement.removeEventListener('mouseenter', this.enter);
                    overlayRef.hostElement.removeEventListener('mouseleave', this.leave);
                });
            }
        }
    }

    @HostListener('mouseleave')
    protected onLeave() {
        this.cleanup();
        this.lastHide = setTimeout(() => {
            const openDropdownHover = this.openDropdownHover();
            if (openDropdownHover && this.lastHide) openDropdownHover.close();
            this.cleanup();
        }, this.openDropdownHoverCloseTimeout());
    }
}

/**
 * A directive to open the given dropdown upon right click / context menu.
 *
 * ```html
 * <dui-dropdown #dropdown>
 * </dui-dropdown>
 *
 * <dui-button [contextDropdown]="dropdown">Open context menu</dui-button>
 * ```
 */
@Directive({ selector: '[contextDropdown]' })
export class ContextDropdownDirective {
    contextDropdown = input<DropdownComponent>();

    @HostListener('contextmenu', ['$event'])
    protected onClick($event: MouseEvent) {
        const contextDropdown = this.contextDropdown();
        if (contextDropdown && $event.button === 2) {
            contextDropdown.close();
            $event.preventDefault();
            $event.stopPropagation();
            contextDropdown.open($event);
        }
    }
}

/**
 * A component that acts as a visual separator or splitter inside a dropdown.
 *
 * ```html
 * <dui-dropdown>
 *     <dui-dropdown-item>Item 1</dui-dropdown-item>
 *     <dui-dropdown-separator />
 *     <dui-dropdown-item>Item 2</dui-dropdown-item>
 * </dui-dropdown>
 */
@Component({
    selector: 'dui-dropdown-splitter,dui-dropdown-separator',
    template: `
      <div></div>
    `,
    host: {
        '[class.dui-normalized]': 'true',
    },
    styles: [`
        :host {
            display: block;
            padding: 4px 0;
        }

        div {
            border-top: 1px solid var(--dui-line-color-light);
        }
    `],
})
export class DropdownSplitterComponent {
}

/**
 * This directive is necessary if you want to load and render the dialog content
 * only when opening the dialog. Without it, it is immediately rendered, which can cause
 * performance and injection issues.
 *
 * ```typescript
 * <dui-dropdown>
 *     <ng-container *dropdownContainer>
 *         Dynamically created upon dropdown instantiation.
 *     </ng-container>
 * </dui-dropdown>
 *
 * ```
 */
@Directive({ selector: '[dropdownContainer]' })
export class DropdownContainerDirective {
    constructor(protected dropdown: DropdownComponent, public template: TemplateRef<any>) {
        this.dropdown.setContainer(this.template);
    }
}

/**
 * Interactive item inside a dropdown.
 *
 * ```html
 * <dui-dropdown>
 *     <dui-dropdown-item (click)="doSomething()">Click me</dui-dropdown-item>
 *     <dui-dropdown-item [selected]="true">Selected item</dui-dropdown-item>
 *     <dui-dropdown-item [disabled]="true">Disabled item</dui-dropdown-item>
 * </dui-dropdown>
 * ```
 */
@Component({
    selector: 'dui-dropdown-item',
    template: `
      @if (selected()) {
        <dui-icon [size]="14" class="selected" name="check"></dui-icon>
      }
      <ng-content></ng-content>
    `,
    host: {
        '[class.dui-normalized]': 'true',
        '[class.selected]': 'selected()',
        '[class.disabled]': 'disabled()',
    },
    styleUrls: ['./dropdown-item.component.scss'],
    imports: [IconComponent],
})
export class DropdownItemComponent {
    selected = input(false);

    disabled = input(false, { transform: booleanAttribute });

    closeOnClick = input<boolean>(true);

    constructor(protected dropdown: DropdownComponent) {
    }

    @HostListener('click')
    protected onClick() {
        if (this.closeOnClick()) {
            this.dropdown.close();
        }
    }
}
