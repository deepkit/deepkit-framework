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
    ApplicationRef,
    ChangeDetectorRef,
    Component,
    Directive,
    ElementRef,
    EventEmitter,
    HostBinding,
    HostListener,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Optional,
    Output,
    SkipSelf
} from '@angular/core';
import { WindowComponent } from '../window/window.component';
import { WindowState } from '../window/window-state';
import { FormComponent } from '../form/form.component';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { isMacOs, isRouteActive } from '../../core/utils';

/**
 * hotkey has format of "ctrl+shift+alt+key", e.g "ctrl+s" or "shift+o"
 * and supports more than one, e.g. "ctrl+s,ctrl+o"
 */
export type HotKey = string;

function hotKeySize(hotkey: HotKey) {
    const hotkeys = hotkey.split(',');
    let size = hotkeys.length - 1;
    const isMac = isMacOs(); //mac uses one char per key, windows uses '⊞ WIN' for meta key, 'CTRL' for ctrl key, 'ALT' for alt key
    for (const hotkey of hotkeys) {
        const keys = hotkey.split('+');
        for (const key of keys) {
            if (key === 'ctrl') size += isMac ? 1 : 4;
            if (key === 'meta') size += isMac ? 1 : 4;
            if (key === 'shift') size += 1;
            if (key === 'alt') size += isMac ? 1 : 3;
            if (key !== 'ctrl' && key !== 'meta' && key !== 'alt' && key !== 'shift') size += key.length;
        }
    }

    return size;
}

function isHotKeyActive(hotkey: HotKey, event: KeyboardEvent) {
    const eventKey = event.key.toLowerCase();

    const hotkeys = hotkey.split(',');
    for (const hotkey of hotkeys) {
        const keys = hotkey.split('+');
        let match = true;
        for (const key of keys) {
            if (key === 'ctrl' && !event.ctrlKey) {
                match = false;
                break;
            }
            if (key === 'meta' && (!event.ctrlKey && !event.metaKey)) {
                match = false;
                break;
            }
            if (key === 'shift' && !event.shiftKey) {
                match = false;
                break;
            }
            if (key === 'alt' && !event.altKey) {
                match = false;
                break;
            }
            if (key !== 'ctrl' && key !== 'meta' && key !== 'alt' && key !== 'shift' && key !== eventKey) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }

    return false;
}


@Component({
    selector: 'dui-button-hotkey',
    styles: [`
        :host {
            display: inline-flex;
            flex-direction: row;
        }

        span {
            text-transform: uppercase;
            color: var(--text-grey);
            margin-left: 3px;
            font-size: 11px;
        }
    `],
    template: `
        <span *ngIf="metaKey">{{isMac ? '⌘' : 'WIN'}}</span>
        <span *ngIf="ctrlKey">{{isMac ? '⌃' : 'CTRL'}}</span>
        <span *ngIf="altKey">{{isMac ? '⌥' : 'ALT'}}</span>
        <span *ngIf="shiftKey">⇧</span>
        <span *ngIf="key">{{key}}</span>
    `
})
export class ButtonHotkeyComponent implements OnChanges, OnInit {
    @Input() hotkey?: HotKey;

    isMac = isMacOs();

    metaKey = false;
    ctrlKey = false;
    shiftKey = false;
    altKey = false;
    key = '';

    ngOnInit() {
        this.parse();
    }

    ngOnChanges() {
        this.parse();
    }

    parse() {
        //reset all
        this.metaKey = false;
        this.ctrlKey = false;
        this.shiftKey = false;
        this.altKey = false;
        this.key = '';

        if (!this.hotkey) return;

        const hotkeys = this.hotkey.split(',');
        for (const hotkey of hotkeys) {
            const keys = hotkey.split('+');
            for (const key of keys) {
                if (key === 'ctrl') this.ctrlKey = true;
                if (key === 'meta') this.metaKey = true;
                if (key === 'shift') this.shiftKey = true;
                if (key === 'alt') this.altKey = true;
                if (key !== 'ctrl' && key !== 'shift' && key !== 'alt' && key !== 'meta') this.key = key;
            }
        }
    }
}

@Component({
    selector: 'dui-button',
    template: `
        <dui-icon *ngIf="icon && iconRight === false" [color]="iconColor" [name]="icon" [size]="iconSize"></dui-icon>
        <ng-content></ng-content>
        <dui-icon *ngIf="icon && iconRight !== false" [color]="iconColor" [name]="icon" [size]="iconSize"></dui-icon>
        <div *ngIf="showHotkey" class="show-hotkey" [style.width.px]="hotKeySize(showHotkey) * 6"></div>
        <dui-button-hotkey *ngIf="showHotkey" style="position: absolute; right: 6px; top: 0;" [hotkey]="showHotkey"></dui-button-hotkey>
    `,
    host: {
        '[attr.tabindex]': '1',
        '[class.icon]': '!!icon',
        '[class.small]': 'small !== false',
        '[class.tight]': 'tight !== false',
        '[class.active]': 'isActive()',
        '[class.highlighted]': 'highlighted !== false',
        '[class.primary]': 'primary !== false',
        '[class.icon-left]': 'iconRight === false',
        '[class.icon-right]': 'iconRight !== false',
        '[class.with-text]': 'hasText()',
    },
    styleUrls: ['./button.component.scss'],
})
export class ButtonComponent implements OnInit, AfterViewInit {
    hotKeySize = hotKeySize;

    /**
     * The icon for this button. Either a icon name same as for dui-icon, or an image path.
     */
    @Input() icon?: string;

    /**
     * Change in the icon size. Should not be necessary usually.
     */
    @Input() iconSize?: number;

    @Input() iconRight?: boolean | '' = false;

    @Input() iconColor?: string;

    @Input() showHotkey?: HotKey;

    /**
     * Whether the button is active (pressed)
     */
    @Input() active: boolean | '' = false;
    @Input() routerLink?: string | UrlTree | any[];
    @Input() routerLinkExact?: boolean;

    /**
     * Whether the button has no padding and smaller font size
     */
    @Input() small: boolean | '' = false;

    /**
     * Whether the button has smaller padding. Better for button with icons.
     */
    @Input() tight: boolean | '' = false;

    /**
     * Whether the button is highlighted.
     */
    @Input() highlighted: boolean | '' = false;

    /**
     * Whether the button is primary.
     */
    @Input() primary: boolean | '' = false;

    /**
     * Whether the button is focused on initial loading.
     */
    @Input() focused: boolean | '' = false;

    /**
     * Whether the button is focused on initial loading.
     */
    @Input() submitForm?: FormComponent;

    /**
     * Auto-detected but could be set manually as well.
     * Necessary for correct icon placement.
     */
    withText?: boolean;
    protected detectedText: boolean = false;

    constructor(
        public element: ElementRef,
        @SkipSelf() public cdParent: ChangeDetectorRef,
        @Optional() public formComponent: FormComponent,
        @Optional() public router?: Router,
        @Optional() public activatedRoute?: ActivatedRoute,
    ) {
        this.element.nativeElement.removeAttribute('tabindex');
    }

    hasText() {
        return this.withText === undefined ? this.detectedText : this.withText;
    }

    @Input() disabled: boolean | '' = false;

    @HostBinding('class.disabled')
    get isDisabled() {
        if (this.formComponent && this.formComponent.disabled) return true;
        if (this.submitForm && (this.submitForm.invalid || this.submitForm.disabled || this.submitForm.submitting)) {
            return true;
        }

        return false !== this.disabled;
    }

    @Input() square: boolean | '' = false;

    @HostBinding('class.square')
    get isRound() {
        return false !== this.square;
    }

    @Input() textured: boolean | '' = false;

    @HostBinding('class.textured')
    get isTextured() {
        return false !== this.textured;
    }

    ngOnInit() {
        if (this.focused !== false) {
            setTimeout(() => {
                this.element.nativeElement.focus();
            }, 10);
        }
    }

    isActive() {
        if (this.routerLink && this.router) return isRouteActive(this);
        return false !== this.active;
    }

    ngAfterViewInit() {
        if (this.icon) {
            const content = this.element.nativeElement.innerText.trim();
            const hasText = content !== this.icon && content.length > 0;
            if (hasText) {
                this.detectedText = true;
                this.cdParent.detectChanges();
            }
        }
    }

    @HostListener('click')
    async onClick() {
        if (this.isDisabled) return;

        if (this.submitForm) {
            this.submitForm.submitForm();
        }
    }
}

@Directive({
    selector: '[hotkey]'
})
export class HotkeyDirective {
    @Input() hotkey!: HotKey;
    protected oldButtonActive?: boolean | '';

    protected active = false;

    constructor(
        private elementRef: ElementRef,
        private app: ApplicationRef,
        @Optional() private button?: ButtonComponent,
    ) {
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        //if only alt is pressed (not other keys, we display the hotkey)
        if (event.key.toLowerCase() === 'alt') {
            if (this.button) {
                this.button.showHotkey = this.hotkey;
                return;
            }
        }

        const active = isHotKeyActive(this.hotkey, event);
        // console.log('keydown', event.key, this.hotkey, isHotKeyActive(this.hotkey, event));
        if (!active) return;
        event.preventDefault();

        if (this.active) return;
        this.active = true;
        this.elementRef.nativeElement.click();

        if (this.button) {
            this.oldButtonActive = this.button.active;
            this.button.active = true;

            setTimeout(() => {
                if (this.button && this.oldButtonActive !== undefined) {
                    this.button.active = this.oldButtonActive;
                    this.oldButtonActive = undefined;
                    this.button.cdParent.detectChanges();
                    this.active = false;
                    this.app.tick();
                }
            }, 40);
        }
    }

    @HostListener('document:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent) {
        //if only alt is pressed (not other keys, we display the hotkey)
        if (event.key.toLowerCase() === 'alt') {
            if (this.button) {
                this.button.showHotkey = undefined;
                return;
            }
        }

        // console.log('keyup', event.key, this.hotkey, isHotKeyActive(this.hotkey, event));
        // if (!isHotKeyActive(this.hotkey, event)) return;
        // event.preventDefault();
        // this.elementRef.nativeElement.click();
        // if (this.button && this.oldButtonActive !== undefined) {
        //     this.button.active = this.oldButtonActive;
        // }
    }
}

/**
 * Used to group buttons together.
 */
@Component({
    selector: 'dui-button-group',
    template: '<ng-content></ng-content>',
    host: {
        '[class.float-right]': 'float===\'right\'',
        '(transitionend)': 'transitionEnded()'
    },
    styleUrls: ['./button-group.component.scss']
})
export class ButtonGroupComponent implements AfterViewInit, OnDestroy {
    /**
     * How the button should behave.
     * `sidebar` means it aligns with the sidebar. Is the sidebar open, this button-group has a left margin.
     * Is it closed, the margin is gone.
     */
    @Input() float: 'static' | 'sidebar' | 'float' | 'right' = 'static';

    @Input() padding: 'normal' | 'none' = 'normal';

    @HostBinding('class.padding-none')
    get isPaddingNone() {
        return this.padding === 'none';
    }

    // @HostBinding('class.ready')
    // protected init = false;

    constructor(
        private element: ElementRef<HTMLElement>,
        @SkipSelf() protected cd: ChangeDetectorRef,
        @Optional() private windowState?: WindowState,
        @Optional() private windowComponent?: WindowComponent,
    ) {
    }

    public activateOneTimeAnimation() {
        (this.element.nativeElement as HTMLElement).classList.add('with-animation');
    }

    public sidebarMoved() {
        this.updatePaddingLeft();
    }

    ngOnDestroy(): void {
    }

    transitionEnded() {
        (this.element.nativeElement as HTMLElement).classList.remove('with-animation');
    }

    ngAfterViewInit(): void {
        if (this.float === 'sidebar' && this.windowState) {
            this.windowState.buttonGroupAlignedToSidebar = this;
        }
        this.updatePaddingLeft();
    }

    updatePaddingLeft() {
        if (this.float === 'sidebar' && this.windowComponent) {
            if (this.windowComponent.content) {
                if (this.windowComponent.content!.isSidebarVisible()) {
                    const newLeft = Math.max(0, this.windowComponent.content!.getSidebarWidth() - this.element.nativeElement.offsetLeft) + 'px';
                    if (this.element.nativeElement.style.paddingLeft == newLeft) {
                        //no transition change, doesn't trigger transitionEnd
                        (this.element.nativeElement as HTMLElement).classList.remove('with-animation');
                        return;
                    }
                    this.element.nativeElement.style.paddingLeft = newLeft;
                    return;
                }
            }
        }
        this.element.nativeElement.style.paddingLeft = '0px';
    }
}


@Component({
    selector: 'dui-button-groups',
    template: `
        <ng-content></ng-content>
    `,
    host: {
        '[class.align-left]': `align === 'left'`,
        '[class.align-center]': `align === 'center'`,
        '[class.align-right]': `align === 'right'`,
    },
    styleUrls: ['./button-groups.component.scss'],
})
export class ButtonGroupsComponent {
    @Input() align: 'left' | 'center' | 'right' = 'left';
}

@Directive({
    selector: '[duiFileChooser]',
    providers: [ngValueAccessor(FileChooserDirective)]
})
export class FileChooserDirective extends ValueAccessorBase<any> implements OnDestroy, OnChanges {
    @Input() duiFileMultiple?: boolean | '' = false;
    @Input() duiFileDirectory?: boolean | '' = false;

    // @Input() duiFileChooser?: string | string[];
    @Output() duiFileChooserChange = new EventEmitter<string | string[]>();

    protected input: HTMLInputElement;

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
        private app: ApplicationRef,
    ) {
        super(injector, cd, cdParent);
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        this.input = input;
        this.input.addEventListener('change', (event: any) => {
            const files = event.target.files as FileList;
            if (files.length) {
                if (this.duiFileMultiple !== false) {
                    const paths: string[] = [];
                    for (let i = 0; i < files.length; i++) {
                        const file = files.item(i) as any as { path: string, name: string };
                        paths.push(file.path);
                    }
                    this.innerValue = paths;
                } else {
                    const file = files.item(0) as any as { path: string, name: string };
                    this.innerValue = file.path;
                }
                this.duiFileChooserChange.emit(this.innerValue);
                this.app.tick();
            }
        });
    }

    ngOnDestroy() {
    }

    ngOnChanges(): void {
        (this.input as any).webkitdirectory = this.duiFileDirectory !== false;
        this.input.multiple = this.duiFileMultiple !== false;
    }

    @HostListener('click')
    onClick() {
        this.input.click();
    }
}

export interface FilePickerItem {
    data: Uint8Array;
    name: string;
}

function readFile(file: File): Promise<Uint8Array | undefined> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result) {
                if (reader.result instanceof ArrayBuffer) {
                    resolve(new Uint8Array(reader.result));
                } else {
                    resolve(undefined);
                }
            }
        };
        reader.onerror = (error) => {
            console.log('Error: ', error);
            reject();
        };

        reader.readAsArrayBuffer(file);
    });
}

@Directive({
    selector: '[duiFilePicker]',
    providers: [ngValueAccessor(FileChooserDirective)]
})
export class FilePickerDirective extends ValueAccessorBase<any> implements OnDestroy, AfterViewInit {
    @Input() duiFileMultiple?: boolean | '' = false;
    @Input() duiFileAutoOpen: boolean = false;

    @Output() duiFilePickerChange = new EventEmitter<FilePickerItem | FilePickerItem[]>();

    protected input: HTMLInputElement;

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
        private app: ApplicationRef,
    ) {
        super(injector, cd, cdParent);
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        this.input = input;

        this.input.addEventListener('change', async (event: any) => {
            const files = event.target.files as FileList;
            if (files.length) {
                if (this.duiFileMultiple !== false) {
                    const res: FilePickerItem[] = [];
                    for (let i = 0; i < files.length; i++) {
                        const file = files.item(i);
                        if (file) {
                            const uint8Array = await readFile(file);
                            if (uint8Array) {
                                res.push({ data: uint8Array, name: file.name });
                            }
                        }
                    }
                    this.innerValue = res;
                } else {
                    const file = files.item(0);
                    if (file) {
                        this.innerValue = { data: await readFile(file), name: file.name };
                    }
                }
                this.duiFilePickerChange.emit(this.innerValue);
                this.app.tick();
            }
        });
    }

    ngOnDestroy() {
    }

    ngAfterViewInit() {
        if (this.duiFileAutoOpen) this.onClick();
    }

    @HostListener('click')
    onClick() {
        this.input.multiple = this.duiFileMultiple !== false;
        this.input.click();
    }
}

@Directive({
    selector: '[duiFileDrop]',
    host: {
        '[class.file-drop-hover]': 'i > 0',
    },
    providers: [ngValueAccessor(FileChooserDirective)]
})
export class FileDropDirective extends ValueAccessorBase<any> implements OnDestroy {
    @Input() duiFileDropMultiple?: boolean | '' = false;

    @Output() duiFileDropChange = new EventEmitter<FilePickerItem | FilePickerItem[]>();

    // hover = false;
    i: number = 0;

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
        private app: ApplicationRef,
    ) {
        super(injector, cd, cdParent);
    }

    @HostListener('dragenter', ['$event'])
    onDragEnter(ev: any) {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        this.i++;
        this.cdParent.detectChanges();
    }

    @HostListener('dragover', ['$event'])
    onDragOver(ev: any) {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
    }

    @HostListener('dragleave', ['$event'])
    onDragLeave(ev: any) {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        this.i--;
        this.cdParent.detectChanges();
    }

    @HostListener('drop', ['$event'])
    async onDrop(ev: any) {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();

        const res: FilePickerItem[] = [];
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (let i = 0; i < ev.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (ev.dataTransfer.items[i].kind === 'file') {
                    const file = ev.dataTransfer.items[i].getAsFile();
                    if (file) {
                        const uint8Array = await readFile(file);
                        if (uint8Array) {
                            res.push({ data: uint8Array, name: file.name });
                        }
                    }
                }
            }
        } else {
            // Use DataTransfer interface to access the file(s)
            for (let i = 0; i < ev.dataTransfer.files.length; i++) {
                const file = ev.dataTransfer.files.item(i);
                if (file) {
                    const uint8Array = await readFile(file);
                    if (uint8Array) {
                        res.push({ data: uint8Array, name: file.name });
                    }
                }
            }
        }
        if (this.duiFileDropMultiple !== false) {
            this.innerValue = res;
        } else {
            if (res.length) {
                this.innerValue = res[0];
            } else {
                this.innerValue = undefined;
            }
        }
        this.duiFileDropChange.emit(this.innerValue);
        this.i = 0;
        this.cdParent.detectChanges();
    }

    ngOnDestroy() {
    }
}
