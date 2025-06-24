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
    booleanAttribute,
    ChangeDetectorRef,
    Component,
    computed,
    Directive,
    effect,
    ElementRef,
    forwardRef,
    HostBinding,
    HostListener,
    inject,
    input,
    model,
    OnChanges,
    OnDestroy,
    OnInit,
    Optional,
    output,
    signal,
    SkipSelf,
} from '@angular/core';
import { WindowComponent } from '../window/window.component';
import { AlignedButtonGroup, WindowState } from '../window/window-state';
import { FormComponent } from '../form/form.component';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { isMacOs } from '../../core/utils';

import { IconComponent } from '../icon/icon.component';
import { RouterLinkActive } from '@angular/router';
import { injectElementRef } from '../app/utils';

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
            color: var(--dui-text-grey);
            margin-left: 3px;
            font-size: 11px;
        }
    `],
    template: `
      @if (metaKey) {
        <span>{{ isMac ? '⌘' : 'WIN' }}</span>
      }
      @if (ctrlKey) {
        <span>{{ isMac ? '⌃' : 'CTRL' }}</span>
      }
      @if (altKey) {
        <span>{{ isMac ? '⌥' : 'ALT' }}</span>
      }
      @if (shiftKey) {
        <span>⇧</span>
      }
      @if (key) {
        <span>{{ key }}</span>
      }
    `,
    imports: [],
})
export class ButtonHotkeyComponent implements OnChanges, OnInit {
    hotkey = input<HotKey>('');

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

        const hotkeyValue = this.hotkey();
        if (!hotkeyValue) return;

        const hotkeys = hotkeyValue.split(',');
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
      @if (icon() && !iconRight()) {
        <dui-icon [color]="iconColor()" [name]="icon()" [size]="iconSize()"></dui-icon>
      }
      <ng-content></ng-content>
      @if (icon() && iconRight()) {
        <dui-icon [color]="iconColor()" [name]="icon()" [size]="iconSize()"></dui-icon>
      }
      @if (showHotkey()) {
        <div class="show-hotkey" [style.width.px]="hotKeySize(showHotkey()) * 6"></div>
      }
      @if (showHotkey()) {
        <dui-button-hotkey style="position: absolute; right: 6px; top: 0;" [hotkey]="showHotkey()"></dui-button-hotkey>
      }
    `,
    host: {
        '[class.dui-normalized]': 'true',
        '[attr.tabindex]': '1',
        '[class.icon]': '!!icon()',
        '[class.small]': 'small()',
        '[class.tight]': 'tight()',
        '[class.highlighted]': 'highlighted()',
        '[class.primary]': 'primary()',
        '[class.icon-left]': '!iconRight()',
        '[class.icon-right]': 'iconRight()',
        '[class.with-text]': 'hasText()',
        '[class.square]': 'square()',
        '[class.textured]': 'textured()',
        '[class.active]': 'isActive()',
        '[class.disabled]': 'isDisabled()',
    },
    styleUrls: ['./button.component.scss'],
    hostDirectives: [
        { directive: RouterLinkActive, inputs: ['routerLinkActiveOptions'] },
    ],
    imports: [
        IconComponent,
        ButtonHotkeyComponent,
        forwardRef(() => HotkeyDirective),
    ],
})
export class ButtonComponent implements OnInit, AfterViewInit {
    hotKeySize = hotKeySize;

    /**
     * The icon for this button. Either a icon name same as for dui-icon, or an image path.
     */
    icon = input<string>();

    /**
     * Change in the icon size. Should not be necessary usually.
     */
    iconSize = input<number>();

    iconRight = input(false, { transform: booleanAttribute });

    iconColor = input<string>();

    showHotkey = model<HotKey>('');

    /**
     * Whether the button is active (pressed)
     */
    active = model<boolean>(false);

    /**
     * Whether the button has no padding and smaller font size
     */
    small = input(false, { transform: booleanAttribute });

    /**
     * Whether the button has smaller padding. Better for button with icons.
     */
    tight = input(false, { transform: booleanAttribute });

    /**
     * Whether the button is highlighted.
     */
    highlighted = input(false, { transform: booleanAttribute });

    /**
     * Whether the button is primary.
     */
    primary = input(false, { transform: booleanAttribute });

    /**
     * Whether the button is focused on initial loading.
     */
    focused = input(false, { transform: booleanAttribute });

    /**
     * Whether the button is focused on initial loading.
     */
    submitForm = input<FormComponent>();

    disabled = input(false, { transform: booleanAttribute });
    square = input(false, { transform: booleanAttribute });
    textured = input(false, { transform: booleanAttribute });

    /**
     * Auto-detected but could be set manually as well.
     * Necessary for correct icon placement.
     */
    withText?: boolean;
    protected detectedText: boolean = false;

    element = injectElementRef();
    formComponent = inject(FormComponent, { optional: true });
    routerLinkActive = inject(RouterLinkActive);

    isDisabled = computed(() => {
        if (this.formComponent && this.formComponent.disabled()) return true;
        const submitForm = this.submitForm();
        if (submitForm && (submitForm.invalid || submitForm.disabled() || submitForm.submitting())) {
            return true;
        }

        return this.disabled();
    });

    constructor() {
        this.element.nativeElement.removeAttribute('tabindex');
    }

    hasText() {
        return this.withText === undefined ? this.detectedText : this.withText;
    }

    isActive() {
        return this.routerLinkActive.isActive || this.active();
    }

    ngOnInit() {
        if (this.focused()) {
            setTimeout(() => {
                this.element.nativeElement.focus();
            }, 10);
        }
    }

    ngAfterViewInit() {
        const icon = this.icon();
        if (icon) {
            const content = this.element.nativeElement.innerText.trim();
            const hasText = content !== icon && content.length > 0;
            if (hasText) {
                this.detectedText = true;
            }
        }
    }

    @HostListener('click')
    async onClick() {
        if (this.isDisabled()) return;

        const submitForm = this.submitForm();
        if (submitForm) {
            void submitForm.submitForm();
        }
    }
}

@Directive({ selector: '[hotkey]' })
export class HotkeyDirective {
    hotkey = input.required<HotKey>();
    protected oldButtonActive?: boolean;

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
                this.button.showHotkey.set(this.hotkey());
                return;
            }
        }

        const active = isHotKeyActive(this.hotkey(), event);
        if (!active) return;
        event.preventDefault();

        if (this.active) return;
        this.active = true;
        this.elementRef.nativeElement.click();

        if (this.button) {
            this.oldButtonActive = this.button.active();
            this.button.active.set(true);

            setTimeout(() => {
                if (this.button && this.oldButtonActive !== undefined) {
                    this.button.active.set(this.oldButtonActive);
                    this.oldButtonActive = undefined;
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
                this.button.showHotkey.set('');
                return;
            }
        }
    }
}

/**
 * Used to group buttons together.
 */
@Component({
    selector: 'dui-button-group',
    template: '<ng-content></ng-content>',
    host: {
        '[class.float-right]': 'float()===\'right\'',
        '(transitionend)': 'transitionEnded()',
    },
    styleUrls: ['./button-group.component.scss'],
})
export class ButtonGroupComponent implements AfterViewInit, OnDestroy, AlignedButtonGroup {
    /**
     * How the button should behave.
     * `sidebar` means it aligns with the sidebar. Is the sidebar open, this button-group has a left margin.
     * Is it closed, the margin is gone.
     */
    float = input<'static' | 'sidebar' | 'float' | 'right'>('static');

    padding = input<'normal' | 'none'>('normal');

    @HostBinding('class.padding-none')
    get isPaddingNone() {
        return this.padding() === 'none';
    }

    constructor(
        private element: ElementRef<HTMLElement>,
        @SkipSelf() protected cd: ChangeDetectorRef,
        @Optional() private windowState?: WindowState,
        @Optional() private windowComponent?: WindowComponent,
    ) {
        effect(() => this.updatePaddingLeft());
    }

    public activateOneTimeAnimation() {
        (this.element.nativeElement as HTMLElement).classList.add('with-animation');
    }

    ngOnDestroy(): void {
        if (this.windowState && this.windowState.buttonGroupAlignedToSidebar() === this) {
            this.windowState.buttonGroupAlignedToSidebar.set(undefined);
        }
    }

    transitionEnded() {
        (this.element.nativeElement as HTMLElement).classList.remove('with-animation');
    }

    ngAfterViewInit(): void {
        if (this.float() === 'sidebar' && this.windowState) {
            this.windowState.buttonGroupAlignedToSidebar.set(this);
        }
    }

    updatePaddingLeft() {
        if (this.float() === 'sidebar' && this.windowComponent) {
            const content = this.windowComponent.content();
            if (content && content.isSidebarVisible()) {
                const newLeft = Math.max(0, content.sidebarWidth() - this.element.nativeElement.offsetLeft) + 'px';
                if (this.element.nativeElement.style.paddingLeft == newLeft) {
                    //no transition change, doesn't trigger transitionEnd
                    (this.element.nativeElement as HTMLElement).classList.remove('with-animation');
                    return;
                }
                this.element.nativeElement.style.paddingLeft = newLeft;
                return;
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
        '[class.align-left]': `align() === 'left'`,
        '[class.align-center]': `align() === 'center'`,
        '[class.align-right]': `align() === 'right'`,
    },
    styleUrls: ['./button-groups.component.scss'],
})
export class ButtonGroupsComponent {
    align = input<'left' | 'center' | 'right'>('left');
}

@Directive({
    selector: '[duiFileChooser]',
    providers: [ngValueAccessor(FileChooserDirective)],
})
export class FileChooserDirective extends ValueAccessorBase<string[]> implements OnDestroy, OnChanges {
    duiFileMultiple = input(false, { transform: booleanAttribute });
    duiFileDirectory = input(false, { transform: booleanAttribute });

    duiFileChooserChange = output<string[]>();

    protected input: HTMLInputElement;

    constructor() {
        super();
        const inputElement = document.createElement('input');
        inputElement.setAttribute('type', 'file');
        this.input = inputElement;
        this.input.addEventListener('change', (event: any) => {
            const files = event.target.files as FileList;
            if (files.length) {
                if (this.duiFileMultiple()) {
                    const paths: string[] = [];
                    for (let i = 0; i < files.length; i++) {
                        const file = files.item(i) as any as { path: string, name: string };
                        paths.push(file.path);
                    }
                    this.writeValue(paths);
                } else {
                    const file = files.item(0) as any as { path: string, name: string };
                    this.writeValue([file.path]);
                }
                this.duiFileChooserChange.emit(this.value() || []);
            }
        });
    }

    ngOnDestroy() {
    }

    ngOnChanges(): void {
        (this.input as any).webkitdirectory = this.duiFileDirectory();
        this.input.multiple = this.duiFileMultiple();
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
    providers: [ngValueAccessor(FileChooserDirective)],
})
export class FilePickerDirective extends ValueAccessorBase<FilePickerItem[]> implements OnDestroy, AfterViewInit {
    duiFileMultiple = input(false, { transform: booleanAttribute });
    duiFileAutoOpen = input<boolean>(false);

    duiFilePickerChange = output<FilePickerItem[]>();

    protected input: HTMLInputElement;

    constructor() {
        super();
        const inputElement = document.createElement('input');
        inputElement.setAttribute('type', 'file');
        this.input = inputElement;

        this.input.addEventListener('change', async (event: any) => {
            const files = event.target.files as FileList;
            if (files.length) {
                if (this.duiFileMultiple() !== false) {
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
                    this.writeValue(res);
                } else {
                    const file = files.item(0);
                    if (file) {
                        const data = await readFile(file);
                        if (data) {
                            this.writeValue([{ data, name: file.name }]);
                        }
                    }
                }
                this.duiFilePickerChange.emit(this.value() || []);
            }
        });
    }

    ngOnDestroy() {
    }

    ngAfterViewInit() {
        if (this.duiFileAutoOpen()) this.onClick();
    }

    @HostListener('click')
    onClick() {
        this.input.multiple = this.duiFileMultiple();
        this.input.click();
    }
}

@Directive({
    selector: '[duiFileDrop]',
    host: {
        '[class.file-drop-hover]': 'i() > 0',
    },
    providers: [ngValueAccessor(FileChooserDirective)],
})
export class FileDropDirective extends ValueAccessorBase<FilePickerItem[]> implements OnDestroy {
    duiFileDropMultiple = input(false, { transform: booleanAttribute });
    duiFileDropChange = output<FilePickerItem[]>();

    i = signal(0);

    @HostListener('dragenter', ['$event'])
    onDragEnter(ev: any) {
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        this.i.update(v => v + 1);
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
        this.i.update(v => v - 1);
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
        if (this.duiFileDropMultiple()) {
            this.writeValue(res);
        } else {
            if (res.length) {
                this.writeValue([res[0]]);
            } else {
                this.writeValue([]);
            }
        }
        this.duiFileDropChange.emit(this.value() || []);
        this.i.set(0);
    }

    ngOnDestroy() {
    }
}
