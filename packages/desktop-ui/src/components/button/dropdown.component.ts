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
    ChangeDetectorRef,
    Component,
    Directive,
    ElementRef,
    EventEmitter,
    HostListener,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    Optional,
    Output,
    SimpleChanges,
    SkipSelf,
    TemplateRef,
    ViewChild,
    ViewContainerRef
} from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';
import { Overlay, OverlayConfig, OverlayRef, PositionStrategy } from '@angular/cdk/overlay';
import { Subscription } from 'rxjs';
import { WindowRegistry } from '../window/window-state';
import { focusWatcher } from '../../core/utils';
import { isArray } from '@deepkit/core';
import { OverlayStack, OverlayStackItem, ReactiveChangeDetectionModule, unsubscribe } from '../app';
import { ButtonComponent } from './button.component';


@Component({
    selector: 'dui-dropdown',
    template: `
        <ng-template #dropdownTemplate>
            <div class="dui-dropdown" tabindex="1" #dropdown>
                <!--                <div *ngIf="overlay !== false" class="dui-dropdown-arrow"></div>-->
                <div class="content" [class.overlay-scrollbar-small]="scrollbars">
                    <ng-content></ng-content>
                </div>
            </div>
        </ng-template>
    `,
    host: {
        '[class.overlay]': 'overlay !== false',
    },
    styleUrls: ['./dropdown.component.scss']
})
export class DropdownComponent implements OnChanges, OnDestroy, AfterViewInit {
    public isOpen = false;
    public overlayRef?: OverlayRef;
    protected lastFocusWatcher?: Subscription;

    @Input() host?: HTMLElement | ElementRef;

    @Input() allowedFocus: (HTMLElement | ElementRef)[] | (HTMLElement | ElementRef) = [];

    /**
     * For debugging purposes.
     */
    @Input() keepOpen?: true;

    @Input() height?: number | string;

    @Input() width?: number | string;

    @Input() minWidth?: number | string;

    @Input() minHeight?: number | string;

    @Input() maxWidth?: number | string;

    @Input() maxHeight?: number | string;

    @Input() scrollbars: boolean = true;

    /**
     * Whether the dropdown aligns to the horizontal center.
     */
    @Input() center: boolean = false;

    /**
     * Whether is styled as overlay
     */
    @Input() overlay: boolean | '' = false;

    @Input() show?: boolean;
    @Output() showChange = new EventEmitter<boolean>();

    @Output() shown = new EventEmitter();

    @Output() hidden = new EventEmitter();

    @ViewChild('dropdownTemplate', { static: false, read: TemplateRef }) dropdownTemplate!: TemplateRef<any>;
    @ViewChild('dropdown', { static: false, read: ElementRef }) dropdown!: ElementRef<HTMLElement>;

    protected lastOverlayStackItem?: OverlayStackItem;

    constructor(
        protected overlayService: Overlay,
        protected injector: Injector,
        protected registry: WindowRegistry,
        protected overlayStack: OverlayStack,
        protected viewContainerRef: ViewContainerRef,
        protected cd: ChangeDetectorRef,
        @SkipSelf() protected cdParent: ChangeDetectorRef,
    ) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.show && this.dropdownTemplate) {
            if (this.show === true) this.open();
            if (this.show === false) this.close();
        }
    }

    ngAfterViewInit() {
        if (this.show === true) this.open();
        if (this.show === false) this.close();
    }

    ngOnDestroy(): void {
        this.close();
    }

    @HostListener('window:keyup', ['$event'])
    public key(event: KeyboardEvent) {
        if (this.isOpen && event.key.toLowerCase() === 'escape' && this.lastOverlayStackItem && this.lastOverlayStackItem.isLast()) {
            this.close();
        }
    }

    public toggle(target?: HTMLElement | ElementRef | MouseEvent) {
        if (this.isOpen) {
            this.close();
        } else {
            this.open(target);
        }
    }

    public open(target?: HTMLElement | ElementRef | MouseEvent | 'center') {
        if (this.lastFocusWatcher) {
            this.lastFocusWatcher.unsubscribe();
        }

        if (!target) {
            target = this.host!;
        }

        target = target instanceof ElementRef ? target.nativeElement : target;

        if (!target) {
            throw new Error('No target or host specified for dropdown');
        }
        let position: PositionStrategy | undefined;

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
        const overlay = this.overlayService;

        if (target instanceof MouseEvent) {
            const mousePosition = { x: target.pageX, y: target.pageY };
            position = overlay
                .position()
                .flexibleConnectedTo(mousePosition)
                .withFlexibleDimensions(false)
                .withViewportMargin(12)
                .withPush(true)
                .withDefaultOffsetY(this.overlay !== false ? 15 : 0)
                .withPositions([
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
                    }
                ]);
            ;
        } else if (target === 'center') {

            position = overlay
                .position()
                .global().centerHorizontally().centerVertically();
        } else {
            position = overlay
                .position()
                .flexibleConnectedTo(target)
                .withFlexibleDimensions(false)
                .withViewportMargin(12)
                .withPush(true)
                .withDefaultOffsetY(this.overlay !== false ? 15 : 0)
                .withPositions([
                    {
                        originX: this.center ? 'center' : 'start',
                        originY: 'bottom',
                        overlayX: this.center ? 'center' : 'start',
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
                    }
                ]);
        }

        if (this.overlayRef) {
            this.overlayRef.updatePositionStrategy(position);
            this.overlayRef.updatePosition();
        } else {
            this.isOpen = true;
            const options: OverlayConfig = {
                minWidth: 50,
                maxWidth: 450,
                maxHeight: '90%',
                hasBackdrop: false,
                scrollStrategy: overlay.scrollStrategies.reposition(),
                positionStrategy: position
            };

            if (this.width) options.width = this.width;
            if (this.height) options.height = this.height;
            if (this.minWidth) options.minWidth = this.minWidth;
            if (this.minHeight) options.minHeight = this.minHeight;
            if (this.maxWidth) options.maxWidth = this.maxWidth;
            if (this.maxHeight) options.maxHeight = this.maxHeight;

            this.overlayRef = overlay.create(options);

            if (!this.dropdownTemplate) throw new Error('No dropdownTemplate set');
            const portal = new TemplatePortal(this.dropdownTemplate, this.viewContainerRef);

            this.overlayRef!.attach(portal);

            this.cd.detectChanges();

            this.overlayRef!.updatePosition();
            this.shown.emit();
            this.showChange.emit(true);

            setTimeout(() => {
                if (this.overlayRef) this.overlayRef.updatePosition();
            }, 0);

            setTimeout(() => {
                if (this.overlayRef) this.overlayRef.updatePosition();
            }, 50);

            if (this.lastOverlayStackItem) this.lastOverlayStackItem.release();
            this.lastOverlayStackItem = this.overlayStack.register(this.overlayRef.hostElement);
        }

        const normalizedAllowedFocus = isArray(this.allowedFocus) ? this.allowedFocus : (this.allowedFocus ? [this.allowedFocus] : []);
        const allowedFocus = normalizedAllowedFocus.map(v => v instanceof ElementRef ? v.nativeElement : v) as HTMLElement[];
        allowedFocus.push(this.overlayRef.hostElement);

        if (this.show === undefined) {
            this.overlayRef.hostElement.focus();

            this.lastFocusWatcher = focusWatcher(this.dropdown.nativeElement, [...allowedFocus, target as any], (element) => {
                //if the element is a dialog as well, we don't close

                if (!element) return false;

                if (this.lastOverlayStackItem) {
                    //when there's a overlay above ours we keep it open
                    if (!this.lastOverlayStackItem.isLast()) return true;
                }

                return false;
            }).subscribe(() => {
                if (!this.keepOpen) {
                    this.close();
                    ReactiveChangeDetectionModule.tick();
                }
            });
        }
    }

    public focus() {
        if (!this.dropdown) return;
        this.dropdown.nativeElement.focus();
    }

    public close() {
        if (!this.isOpen) return;

        if (this.lastOverlayStackItem) this.lastOverlayStackItem.release();

        this.isOpen = false;

        if (this.overlayRef) {
            this.overlayRef.dispose();
            this.overlayRef = undefined;
        }

        this.cd.detectChanges();
        this.hidden.emit();
        this.showChange.emit(false);
    }
}

/**
 * A directive to open the given dropdown on regular left click.
 */
@Directive({
    'selector': '[openDropdown]',
})
export class OpenDropdownDirective implements AfterViewInit, OnDestroy {
    @Input() openDropdown?: DropdownComponent;

    @unsubscribe()
    openSub?: Subscription;

    @unsubscribe()
    hiddenSub?: Subscription;

    constructor(
        protected elementRef: ElementRef,
        @Optional() protected button?: ButtonComponent,
    ) {
    }

    ngOnDestroy() {
    }

    ngAfterViewInit() {
        if (this.button && this.openDropdown) {
            this.openSub = this.openDropdown.shown.subscribe(() => {
                if (this.button) this.button.active = true;
            });
            this.hiddenSub = this.openDropdown.hidden.subscribe(() => {
                if (this.button) this.button.active = false;
            });
        }
    }

    @HostListener('click')
    onClick() {
        if (this.openDropdown) {
            this.openDropdown.toggle(this.elementRef);
        }
    }
}

/**
 * A directive to open the given dropdown on mouseenter, and closes automatically on mouseleave.
 * Dropdown keeps open when mouse enters the dropdown
 */
@Directive({
    'selector': '[openDropdownHover]',
})
export class OpenDropdownHoverDirective implements OnDestroy {
    @Input() openDropdownHover?: DropdownComponent;

    /**
     * In milliseconds.
     */
    @Input() openDropdownHoverCloseTimeout: number = 80;

    @unsubscribe()
    openSub?: Subscription;

    @unsubscribe()
    hiddenSub?: Subscription;

    lastHide?: any;

    constructor(
        protected elementRef: ElementRef,
    ) {
    }

    ngOnDestroy() {
    }

    @HostListener('mouseenter')
    onHover() {
        clearTimeout(this.lastHide);
        this.lastHide = undefined;

        if (this.openDropdownHover && !this.openDropdownHover.isOpen) {
            this.openDropdownHover.open(this.elementRef);
            if (this.openDropdownHover.overlayRef) {
                this.openDropdownHover.overlayRef.hostElement.addEventListener('mouseenter', () => {
                    this.onHover();
                });
                this.openDropdownHover.overlayRef.hostElement.addEventListener('mouseleave', () => {
                    this.onLeave();
                });
            }
        }
    }

    @HostListener('mouseleave')
    onLeave() {
        this.lastHide = setTimeout(() => {
            if (this.openDropdownHover && this.lastHide) this.openDropdownHover.close();
        }, this.openDropdownHoverCloseTimeout);
    }
}

/**
 * A directive to open the given dropdown upon right click / context menu.
 */
@Directive({
    'selector': '[contextDropdown]',
})
export class ContextDropdownDirective {
    @Input() contextDropdown?: DropdownComponent;

    @HostListener('contextmenu', ['$event'])
    onClick($event: MouseEvent) {
        if (this.contextDropdown && $event.button === 2) {
            this.contextDropdown.close();
            $event.preventDefault();
            $event.stopPropagation();
            this.contextDropdown.open($event);
        }
    }
}

@Component({
    selector: 'dui-dropdown-splitter,dui-dropdown-separator',
    template: `
        <div></div>
    `,
    styles: [`
        :host {
            display: block;
            padding: 4px 0;
        }

        div {
            border-top: 1px solid var(--line-color-light);
        }
    `]
})
export class DropdownSplitterComponent {
}


@Component({
    selector: 'dui-dropdown-item',
    template: `
        <dui-icon [size]="14" class="selected" *ngIf="selected" name="check"></dui-icon>
        <ng-content></ng-content>
    `,
    host: {
        '[class.selected]': 'selected !== false',
        '[class.disabled]': 'disabled !== false',
    },
    styleUrls: ['./dropdown-item.component.scss']
})
export class DropdownItemComponent {
    @Input() selected = false;

    @Input() disabled: boolean | '' = false;

    @Input() closeOnClick: boolean = true;

    constructor(protected dropdown: DropdownComponent) {
    }

    @HostListener('click')
    onClick() {
        if (this.closeOnClick) {
            this.dropdown.close();
        }
    }
}
