import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import { ControllerClient } from '../../client';
import { Application, Container, Rectangle, Text } from 'pixi.js';
import { ChangeFeed, formatTime, FrameItem, FrameParser, ViewState } from './frame';
import { FrameContainer } from './frame-container';
import { FrameCategory } from '@deepkit/stopwatch';

class TimelineFrameContainer extends FrameContainer {
    public subText: Text;

    protected itemHeight: number = 40;

    constructor(item: FrameItem, offset: number, viewState: ViewState, protected itemX: number) {
        super(item, offset, viewState);

        this.subText = new Text(this.getSubText(), this.textStyle);
        this.subText.y = 22.5;
        this.subText.x = 3.5;
        this.text.addChild(this.subText);

        // TextCalc.get().fontSize = 12;
        // const textDimensions = TextCalc.get().getDimensions(this.subText.text);
        // if (textDimensions.width > this.textDimensions.width) this.textDimensions = textDimensions;

        // this.paintOverTextOverflow.height = this.itemHeight;
        // this.paintOverTextOverflow.width = (this.textDimensions.width - this.frameWidth) + 2;
        this.update();
    }

    protected getSubText() {
        const category = this.item.frame.category ? '[' + FrameCategory[this.item.frame.category] + '] ' : '';
        return `${category} ${formatTime(this.item.took)}, ${this.item.frames} frames`;
    }

    protected updateText() {
        this.subText.text = this.getSubText();
    }

    protected updatePosition() {
        const x = (this.itemX - this.offset - this.viewState.scrollX) / this.viewState.zoom;
        this.x = x + .5;
        this.y = 13 + 0.5;
    }
}

class TimelineContainer extends Container {
    protected frameContainer = new Container();

    filterCategory: number = 0;
    filterQuery: string = '';

    ignoreNextClick = false;

    protected lastEnd: number = 0;

    public selected?: FrameItem;
    protected inactiveAlpha = 0.6;

    constructor(
        public parser: FrameParser,
        public viewState: ViewState,
        public onSelect: (frame?: FrameItem) => void,
    ) {
        super();
        this.addChild(this.frameContainer);
        this.parser.subscribeRoot(this.onNewRootItems.bind(this));

        this.hitArea = new Rectangle(0, 0, this.viewState.width, this.viewState.height);
        this.interactive = true;
        this.on('click', () => {
            if (this.ignoreNextClick) {
                this.ignoreNextClick = false;
                return;
            }
        });
    }

    setSelected(frame?: FrameItem) {
        this.selected = frame;
        this.update();
    }

    updateFilter() {
        this.frameContainer.removeChildren(0);
        this.lastEnd = 0;
        this.viewState.scrollX = 0;

        for (const item of this.parser.rootItems) {
            if (!this.matchesFilter(item)) continue;
            this.create(item);
        }
    }

    matchesFilter(item: FrameItem): boolean {
        if (this.filterCategory > 0 && item.frame.category !== this.filterCategory) return false;
        if (this.filterQuery && this.filterQuery[0] !== '*' && !item.frame.label.toLowerCase().startsWith(this.filterQuery)) return false;
        if (this.filterQuery && this.filterQuery[0] === '*' && !item.frame.label.toLowerCase().includes(this.filterQuery.slice(1))) return false;

        return true;
    }

    onNewRootItems(items: FrameItem[]) {
        this.frameContainer.removeChildren();
        this.lastEnd = 0;

        if (items.length === 0) {
            this.viewState.scrollX = 0;
        }

        for (const item of items) {
            if (!this.matchesFilter(item)) continue;
            this.frameContainer.addChild(this.create(item));
        }
    }

    protected create(item: FrameItem) {
        const container = new TimelineFrameContainer(item, 0, this.viewState, this.lastEnd);

        container.rectangle.interactive = true;
        container.rectangle.addListener('click', (event) => {
            if (this.ignoreNextClick) return;
            event.stopPropagation();
            this.onSelect(item);
        });

        this.lastEnd += item.took + 100;
        return container;
    }

    get containers(): FrameContainer[] {
        return this.frameContainer.children as FrameContainer[];
    }

    update() {
        for (const container of this.containers) {
            if (this.selected) {
                container.rectangle.alpha = container.item.frame.cid === this.selected.frame.cid ? 1 : this.inactiveAlpha;
                container.text.alpha = container.item.frame.cid === this.selected.frame.cid ? 1 : this.inactiveAlpha;
            } else {
                container.rectangle.alpha = 1;
                container.text.alpha = 1;
            }
            container.update();
        }
        this.hitArea = new Rectangle(0, 0, this.viewState.width, this.viewState.height);
    }
}

@Component({
    selector: 'profile-timeline',
    template: `
        <div class="canvas" #canvas></div>
        <div class="controls">
            <ng-container *ngIf="timeline">
                <dui-select textured [(ngModel)]="timeline.filterCategory" (ngModelChange)="updateFilter()">
                    <dui-option [value]="0">All</dui-option>
                    <dui-option [value]="FrameCategory.rpc">RPC</dui-option>
                    <dui-option [value]="FrameCategory.http">HTTP</dui-option>
                    <dui-option [value]="FrameCategory.cli">CLI</dui-option>
                </dui-select>
                <dui-input textured round lightFocus placeholder="Filter ..." clearer [(ngModel)]="timeline.filterQuery" (ngModelChange)="updateFilter()">
                </dui-input>
            </ng-container>
        </div>
    `,
    styleUrls: ['./timeline.component.scss'],
    standalone: false
})
export class ProfileTimelineComponent implements AfterViewInit, OnChanges {
    FrameCategory = FrameCategory;

    @Input() parser!: FrameParser;
    @Input() selected?: FrameItem;
    @Output() selectItem = new EventEmitter();

    protected app = new Application({
        width: 500,
        height: 250,
        antialias: true,
        autoDensity: true,
        transparent: true,
        resolution: window.devicePixelRatio
    });

    viewState = new ViewState();
    public timeline?: TimelineContainer;

    protected updateFilterTimeout?: any;

    @ViewChild('canvas', { read: ElementRef }) canvas?: ElementRef;

    constructor(
        protected client: ControllerClient,
        protected cd: ChangeDetectorRef,
    ) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.selected) {
            this.timeline?.setSelected(this.selected);
        }
    }

    updateFilter() {
        if (!this.timeline) return;

        clearTimeout(this.updateFilterTimeout);

        this.updateFilterTimeout = setTimeout(() => {
            if (this.timeline) this.timeline.updateFilter();
        }, 300);
    }

    onSelect(item?: FrameItem) {
        //todo: @Output
        this.selectItem.emit(item);
    }

    @HostListener('window:resize')
    onResize() {
        if (!this.canvas) return;

        this.viewState.width = this.canvas.nativeElement.clientWidth;
        this.viewState.height = this.canvas.nativeElement.clientHeight;
        this.app.renderer.resize(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);
        this.update();
    }

    protected update() {
        if (!this.timeline) return;

        this.timeline.update();
    }

    async ngAfterViewInit() {
        this.parser.subscribe(this.onUpdate.bind(this), this.viewState);
        this.createCanvas();
    }

    onUpdate(changes: ChangeFeed<FrameItem>) {
        console.log('timeline create', changes);
    }

    protected createCanvas() {
        // The application will create a canvas element for you that you
        // can then insert into the DOM.
        if (!this.canvas) return;

        this.canvas.nativeElement.appendChild(this.app.view);
        this.app.renderer.view.style.position = 'absolute';
        this.app.renderer.view.style.display = 'block';
        this.app.renderer.view.style.width = '100%';
        this.app.renderer.view.style.height = '100%';
        this.app.renderer.resize(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);

        this.viewState.width = this.canvas.nativeElement.clientWidth;
        this.viewState.height = this.canvas.nativeElement.clientHeight;

        this.timeline = new TimelineContainer(this.parser, this.viewState, this.onSelect.bind(this));
        this.app.stage.addChild(this.timeline);

        const mc = new Hammer.Manager(this.app.renderer.view);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

        let offsetXStart = 0;
        mc.on('panstart', () => {
            offsetXStart = this.viewState.scrollX;
            if (this.timeline) this.timeline.ignoreNextClick = true;
        });
        mc.on('panend', () => {
            offsetXStart = this.viewState.scrollX;
        });

        mc.on('pan', (ev) => {
            if (ev.deltaX === 0) return;
            this.viewState.scrollX = offsetXStart - (ev.deltaX * this.viewState.zoom);
            this.update();
        });

        this.app.renderer.view.addEventListener('wheel', (event) => {
            const newZoom = Math.min(1000000, Math.max(0.1, this.viewState.zoom - (Math.min(event.deltaY * -1 / 500, 0.3) * this.viewState.zoom)));
            const ratio = newZoom / this.viewState.zoom;

            const eventOffsetX = event.clientX - this.app.renderer.view.getBoundingClientRect().x;
            this.viewState.scrollX -= (eventOffsetX) * this.viewState.zoom * (ratio - 1);
            this.viewState.zoom = newZoom;

            event.preventDefault();
            this.update();
        });

        this.cd.detectChanges();
    }
}
