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
    OnChanges,
    Output,
    SimpleChanges,
    TemplateRef,
    ViewChild,
    input, booleanAttribute, model, signal,
} from '@angular/core';
import { Subject } from 'rxjs';
import { WindowState } from './window-state';
import { triggerResize } from '../../core/utils';
import { NgTemplateOutlet } from '@angular/common';
import { SplitterComponent } from '../splitter/splitter.component';

interface WinSidebar {
    template: TemplateRef<any>;
}

@Component({
    selector: 'dui-window-content',
    template: `
        <div class="top-line"></div>
        
        <div class="content {{class()}}" #content>
          <ng-content></ng-content>
        </div>
        
        @if (toolbar(); as toolbar) {
          <div class="sidebar"
            (transitionend)="transitionEnded()"
            #sidebar [class.hidden]="!sidebarVisible() " [class.with-animation]="withAnimation"
            [style.width.px]="getSidebarWidth()">
            <div class="hider">
              <div class="sidebar-container overlay-scrollbar-small"
                [style.width.px]="getSidebarWidth()"
                [style.max-width.px]="getSidebarWidth()"
                #sidebarContainer>
                <ng-container [ngTemplateOutlet]="toolbar.template"
                [ngTemplateOutletContext]="{}"></ng-container>
              </div>
            </div>
            <dui-splitter position="right" (sizeChange)="sidebarWidth.set($event); sidebarMoved()"></dui-splitter>
          </div>
        }
        `,
    host: {
        '[class.transparent]': 'transparent() !== false',
    },
    styleUrls: ['./window-content.component.scss'],
    imports: [
    NgTemplateOutlet,
    SplitterComponent
],
})
export class WindowContentComponent implements OnChanges, AfterViewInit {
    transparent = input(false, { transform: booleanAttribute });

    sidebarVisible = input<boolean>(true);

    class = input<string>('');

    sidebarWidth = model(250);
    sidebarMaxWidth = input(550);
    sidebarMinWidth = input(100);

    @Output() sidebarWidthChange = new EventEmitter<number>();

    toolbar = signal<WinSidebar | undefined>(undefined);

    @ViewChild('sidebar', { static: false }) public sidebar?: ElementRef<HTMLElement>;
    @ViewChild('sidebarContainer', { static: false }) public sidebarContainer?: ElementRef<HTMLElement>;
    @ViewChild('content', { static: true }) public content?: ElementRef<HTMLElement>;

    withAnimation: boolean = false;
    public sidebarVisibleChanged = new Subject();

    constructor(
        private windowState: WindowState,
    ) {
    }

    getSidebarWidth(): number {
        return Math.min(this.sidebarMaxWidth(), Math.max(this.sidebarMinWidth(), this.sidebarWidth()));
    }

    transitionEnded() {
        if (this.withAnimation) {
            this.withAnimation = false;
            triggerResize();
        }
    }

    unregisterSidebar(sidebar: WinSidebar) {
        if (this.toolbar() === sidebar) {
            this.toolbar.set(undefined);
            setTimeout(() => this.sidebarMoved(), 0);
        }
    }

    registerSidebar(sidebar: WinSidebar) {
        this.toolbar.set(sidebar);
        setTimeout(() => this.sidebarMoved(), 0);
    }

    sidebarMoved() {
        if (this.windowState.buttonGroupAlignedToSidebar) {
            this.windowState.buttonGroupAlignedToSidebar.sidebarMoved();
        }
        this.sidebarWidthChange.next(this.sidebarWidth());
        triggerResize();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.sidebar && this.sidebarContainer) {
            if (changes.sidebarVisible) {
                this.handleSidebarVisibility(true);
                this.sidebarVisibleChanged.next(this.sidebarVisible());
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
        return undefined !== this.sidebar && this.sidebarVisible();
    }
}
