import {
    AfterViewInit, ChangeDetectorRef,
    Component,
    ContentChild,
    ElementRef, EventEmitter,
    Input,
    OnChanges, Output,
    SimpleChanges,
    ViewChild
} from "@angular/core";
import { WindowSidebarComponent } from "./window-sidebar.component";
import { Subject } from "rxjs";
import { WindowState } from "./window-state";
import { triggerResize } from "../../core/utils";

@Component({
    selector: 'dui-window-content',
    template: `
        <div class="content" #content>
            <ng-content></ng-content>
        </div>

        <div class="sidebar"
             (transitionend)="transitionEnded()"
             #sidebar *ngIf="toolbar" [class.hidden]="!sidebarVisible "[class.with-animation]="withAnimation"
             [style.width.px]="getSidebarWidth()">
            <div class="hider">
                <div class="sidebar-container overlay-scrollbar-small" [style.width.px]="getSidebarWidth()" #sidebarContainer>
                    <ng-container [ngTemplateOutlet]="toolbar!.template" [ngTemplateOutletContext]="{}"></ng-container>
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

    @Input() sidebarWidth = 250;
    @Input() sidebarMaxWidth = 550;
    @Input() sidebarMinWidth = 100;

    @Output() sidebarWidthChange = new EventEmitter<number>();

    @ContentChild(WindowSidebarComponent, { static: false }) toolbar?: WindowSidebarComponent;

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

    sidebarMoved() {
        if (this.windowState.buttonGroupAlignedToSidebar) {
            this.windowState.buttonGroupAlignedToSidebar.sidebarMoved();
        }
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
