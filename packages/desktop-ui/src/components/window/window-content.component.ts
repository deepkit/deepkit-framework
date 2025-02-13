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
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    TemplateRef,
    ViewChild,
} from '@angular/core';
import { Subject } from 'rxjs';
import { WindowState } from './window-state';
import { triggerResize } from '../../core/utils';

interface WinSidebar {
    template: TemplateRef<any>;
}

@Component({
    selector: 'dui-window-content',
    standalone: false,
    template: `
        <div class="top-line"></div>

        <div class="content {{class}}" #content>
            <ng-content></ng-content>
        </div>

        <div class="sidebar"
             (transitionend)="transitionEnded()"
             #sidebar *ngIf="toolbar" [class.hidden]="!sidebarVisible " [class.with-animation]="withAnimation"
             [style.width.px]="getSidebarWidth()">
            <div class="hider">
                <div class="sidebar-container overlay-scrollbar-small"
                     [style.width.px]="getSidebarWidth()"
                     [style.maxWidth.px]="getSidebarWidth()"
                     #sidebarContainer>
                    <ng-container [ngTemplateOutlet]="toolbar!.template"
                                  [ngTemplateOutletContext]="{}"></ng-container>
                </div>
            </div>
            <dui-splitter position="right" (modelChange)="sidebarWidth = $event; sidebarMoved()"></dui-splitter>
        </div>
    `,
    host: {
        '[class.transparent]': 'transparent !== false',
    },
    styleUrls: ['./window-content.component.scss'],
})
export class WindowContentComponent implements OnChanges, AfterViewInit {
    @Input() transparent: boolean | '' = false;

    @Input() sidebarVisible: boolean = true;

    @Input() class: string = '';

    @Input() sidebarWidth = 250;
    @Input() sidebarMaxWidth = 550;
    @Input() sidebarMinWidth = 100;

    @Output() sidebarWidthChange = new EventEmitter<number>();

    toolbar?: WinSidebar;

    @ViewChild('sidebar', { static: false }) public sidebar?: ElementRef<HTMLElement>;
    @ViewChild('sidebarContainer', { static: false }) public sidebarContainer?: ElementRef<HTMLElement>;
    @ViewChild('content', { static: true }) public content?: ElementRef<HTMLElement>;

    withAnimation: boolean = false;
    public readonly sidebarVisibleChanged = new Subject();

    constructor(
        private windowState: WindowState,
        public cd: ChangeDetectorRef,
    ) {
    }

    getSidebarWidth(): number {
        return Math.min(this.sidebarMaxWidth, Math.max(this.sidebarMinWidth, this.sidebarWidth));
    }

    transitionEnded() {
        if (this.withAnimation) {
            this.withAnimation = false;
            triggerResize();
            this.cd.detectChanges();
        }
    }

    unregisterSidebar(sidebar: WinSidebar) {
        if (this.toolbar === sidebar) {
            this.toolbar = undefined;
            setTimeout(() => this.sidebarMoved(), 0);
        }
    }

    registerSidebar(sidebar: WinSidebar) {
        this.toolbar = sidebar;
        setTimeout(() => this.sidebarMoved(), 0);
    }

    sidebarMoved() {
        if (this.windowState.buttonGroupAlignedToSidebar) {
            this.windowState.buttonGroupAlignedToSidebar.sidebarMoved();
        }
        this.sidebarWidthChange.next(this.sidebarWidth);
        triggerResize();
        this.cd.detectChanges();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.sidebar && this.sidebarContainer) {
            if (changes.sidebarVisible) {
                this.handleSidebarVisibility(true);
                this.sidebarVisibleChanged.next(this.sidebarVisible);
            }
        }
    }

    ngAfterViewInit(): void {
        this.handleSidebarVisibility();
    }

    protected handleSidebarVisibility(withAnimation = false) {
        if (withAnimation && this.windowState.buttonGroupAlignedToSidebar) {
            this.withAnimation = true;
            this.windowState.buttonGroupAlignedToSidebar.activateOneTimeAnimation();
            this.windowState.buttonGroupAlignedToSidebar.sidebarMoved();
        }

        // if (this.content) {
        //     if (this.sidebarVisible) {
        //         this.content.nativeElement.style.marginLeft = '0px';
        //     } else {
        //         this.content.nativeElement.style.marginLeft = (-this.sidebarWidth) + 'px';
        //     }
        // }
    }

    public isSidebarVisible(): boolean {
        return undefined !== this.sidebar && this.sidebarVisible;
    }
}
