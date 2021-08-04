import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ControllerClient } from '../../client';
import { decodeFrameData, decodeFrames } from '@deepkit/framework-debug-api';
import { Application, Container, Graphics, InteractionEvent, Rectangle, Text, TextStyle } from 'pixi.js';
import { FrameCategory, FrameEnd, FrameStart } from '@deepkit/stopwatch';
import * as Hammer from 'hammerjs';
import { formatTime, FrameItem, FrameParser } from './frame';
import { FrameContainer } from './frame-container';
import { Subject } from 'rxjs';

class ViewState {
    scrollX: number = 0;
    zoom: number = 20;
    width: number = 500;
    height: number = 100;
    scrollWidth: number = 1;
}

interface FrameData {
    id: number;
    worker: number;
    data: Uint8Array;
}

class ProfilerContainer extends Container {
    protected headerLines = new Graphics();
    protected selectedLines = new Graphics();
    protected headerText = new Container();
    protected frameContainer = new Container();
    protected offsetText: Text;
    protected textStyle = { fontSize: 12, fill: 0xdddddd } as TextStyle;

    protected hoverMenu?: Container;

    public selected?: FrameItem;

    public ignoreNextClick: boolean = false;
    protected inactiveAlpha = 0.6;

    protected parserSub = this.parser.subscribe(this.onUpdate.bind(this));

    constructor(
        public parser: FrameParser,
        public viewState: ViewState,
        public onSelect: (frame?: FrameItem) => void,
    ) {
        super();
        this.addChild(this.headerLines);
        this.addChild(this.headerText);
        this.addChild(this.frameContainer);
        this.addChild(this.selectedLines);
        this.offsetText = new Text('0', this.textStyle);
        this.addChild(this.offsetText);
        this.offsetText.x = 0;
        this.offsetText.y = 13;

        this.hitArea = new Rectangle(0, 0, this.viewState.width, this.viewState.height);

        this.interactive = true;
        this.on('click', () => {
            if (this.ignoreNextClick) {
                this.ignoreNextClick = false;
                return;
            }
            this.setSelected(undefined);
        });

        this.frameContainer.y = 15;
    }

    onUpdate(create: FrameItem[], update: FrameItem[], remove: FrameItem[]) {
        // console.log('create', create, remove);
        for (const item of remove) {
            if (!item.container) continue;
            this.frameContainer.removeChild(item.container);
            item.container = undefined;
        }

        const add: FrameContainer[] = [];
        for (const item of create) {
            const container = item.container = new FrameContainer(item, this.parser.offsetX, this.viewState);

            container.rectangle.interactive = true;

            container.rectangle.addListener('click', (event) => {
                if (this.ignoreNextClick) {
                    //the bg click resets it
                    return;
                }
                event.stopPropagation();
                this.setSelected(item);
            });

            container.rectangle.addListener('mouseover', (event) => {
                this.onHover(container, event);
            });

            container.rectangle.addListener('mousemove', (event) => {
                this.onHoverMove(container, event);
            });

            container.rectangle.addListener('mouseout', (event) => {
                this.onHoverOut(container, event);
            });


            if (this.selected) {
                container.rectangle.alpha = container.item.frame.id === this.selected.frame.id ? 1 : this.inactiveAlpha;
                container.text.alpha = container.item.frame.id === this.selected.frame.id ? 1 : this.inactiveAlpha;
            }

            add.push(container);

            // this.containers.push(container);
            // console.log('children[0].item.x > item.x', children[0] ? children[0].item.frame.label : '', children[0] ? children[0].item.x : '', item.x, item.frame.label);
            // if (children.length) {
            //     if (children[0].item.x > item.x) {
            //         this.frameContainer.addChildAt(container, 0);
            //     // } else if (children[children.length-1].item.x < item.x) {
            //     } else {
            //         this.frameContainer.addChild(container);
            //     }
            // } else {
            //     this.frameContainer.addChild(container);
            // }
        }

        // console.log(children.map(v => v.item.frame.label));
        if (add.length) {
            this.frameContainer.addChild(...add);
            this.containers.sort((a, b) => {
                return a.item.x - b.item.x;
            });
        }
        // this.updateTransform();
    }

    timestampToX(timestamp: number): number {
        return ((timestamp - this.parser.offsetX - this.viewState.scrollX) / this.viewState.zoom);
    }

    protected setWindow() {
        // const padding = (this.viewState.width * 0.05) * this.viewState.zoom;
        const padding = 1;
        const start = (this.viewState.scrollX) - padding;
        const end = start + ((this.viewState.width) * this.viewState.zoom) + padding;
        this.parserSub.setWindow({start, end});
        // console.log('setWindow', start, end, this.viewState);
    }

    viewChanged() {
        this.setWindow();
        this.update();
    }

    addFrames(frames: (FrameStart | FrameEnd)[]) {
        this.setWindow();

        this.parser.feed(frames);
    }

    get containers(): FrameContainer[] {
        return this.frameContainer.children as FrameContainer[];
    }

    setSelected(frame?: FrameItem) {
        if (this.selected && this.selected === frame) {
            this.selected = undefined;
        } else {
            this.selected = frame;
        }

        for (const container of this.containers) {
            if (this.selected) {
                container.rectangle.alpha = container.item.frame.id === this.selected.frame.id ? 1 : this.inactiveAlpha;
                container.text.alpha = container.item.frame.id === this.selected.frame.id ? 1 : this.inactiveAlpha;
            } else {
                container.rectangle.alpha = 1;
                container.text.alpha = 1;
            }
        }
        this.renderSelectedLines();
        this.onSelect(this.selected);
    }

    protected onHover(container: FrameContainer, event: InteractionEvent) {
        if (this.hoverMenu) return;

        this.hoverMenu = new Container();
        const prefix = container.item.frame.category ? '[' + FrameCategory[container.item.frame.category] + '] ' : '';
        const message = new Text(prefix + container.item.frame.label + ' (' + formatTime(container.item.took, 3) + ')', this.textStyle);
        this.hoverMenu.addChild(message);

        this.hoverMenu.x = event.data.global.x;
        this.hoverMenu.y = event.data.global.y + 20;
        this.addChild(this.hoverMenu);
    }

    protected onHoverMove(container: FrameContainer, event: InteractionEvent) {
        if (!this.hoverMenu) return;
        this.hoverMenu.x = event.data.global.x;
        this.hoverMenu.y = event.data.global.y + 20;
    }

    protected onHoverOut(container: FrameContainer, event: InteractionEvent) {
        if (!this.hoverMenu) return;
        this.removeChild(this.hoverMenu);
        this.hoverMenu = undefined;
    }

    forward() {
        const scrollX = this.selected ? this.selected.x - this.parser.offsetX : this.viewState.scrollX;
        for (const frame of this.frameContainer.children as FrameContainer[]) {
            if (frame.item.x - this.parser.offsetX > scrollX) {
                // this.viewState.scrollX = frame.frame.x - this.offsetX;
                this.setSelected(frame.item);
                this.update();
                return;
            }
        }
    }

    update() {
        for (const layer of this.containers) {
            layer.update();
        }
        this.renderHeaderLines();
        this.renderSelectedLines();
        this.hitArea = new Rectangle(0, 0, this.viewState.width, this.viewState.height);
    }

    protected renderSelectedLines() {
        this.selectedLines.clear();
        if (this.selected) {
            this.selectedLines.beginFill(0xeeeeee, 0.5);
            // this.selectedLines.lineStyle(1, 0x73AB77);
            this.selectedLines.drawRect(this.timestampToX(this.selected.x), 0, 1, this.viewState.height);
            if (this.selected.took) {
                this.selectedLines.drawRect(this.timestampToX(this.selected.x + this.selected.took), 0, 1, this.height);
            }
        }
        this.selectedLines.endFill();
    }

    protected renderHeaderLines() {
        let padding = 10 / this.viewState.zoom;
        while (padding < 5) padding += 10 / this.viewState.zoom;

        const jumpSize = 10 * padding;

        this.headerLines.clear();
        this.headerLines.lineStyle(1, 0xffffff, 0.7);

        for (const text of this.headerText.children) {
            text.visible = false;
        }

        const offsetTime = this.viewState.scrollX;
        this.offsetText.text = (offsetTime > 0 ? '+' : '') + formatTime(offsetTime);

        const maxLines = (this.viewState.width + jumpSize) / padding;

        for (let i = 0; i < maxLines; i++) {
            const x = (i * padding);
            this.headerLines.moveTo(x, 0);
            this.headerLines.lineStyle(i % 10 === 0 ? 2 : 1, 0xffffff, 0.7);
            this.headerLines.lineTo(x, i % 10 === 0 ? 12 : i % 5 === 0 ? 7 : 5);

            if (i % 10 === 0 && x > 0) {
                let text = this.headerText.children[i] as Text;
                if (!this.headerText.children[i]) {
                    text = new Text(formatTime(x * this.viewState.zoom), { fontSize: 12, fill: 0xdddddd } as TextStyle);
                    this.headerText.addChild(text);
                }
                text.x = x;
                text.y = 13;
                text.visible = true;
                text.text = formatTime(x * this.viewState.zoom);
            }
        }
    }
}

@Component({
    template: `
        <dui-window-toolbar for="main">
            <dui-button-group>
                <dui-button textured icon="arrow_right" (click)="forward()"></dui-button>
            </dui-button-group>

            <div>
                {{profiler.parser.items.length}} frames, {{profiler.parser.rootItems.length}} contexts
            </div>
        </dui-window-toolbar>

        <!--        <div class="top-frames">-->

        <!--        </div>-->

        <div class="canvas" #canvas></div>

        <profile-timeline [parser]="parser" (selectItem)="timelineSelect($event)"></profile-timeline>

        <div class="inspector text-selection" *ngIf="selectedFrame">
            <h3>{{selectedFrame.frame.label}}</h3>

            <div style="margin-bottom: 10px;">
                <label>Type</label>
                {{FrameCategory[selectedFrame.frame.category]}}
            </div>

            <div style="margin-bottom: 10px;">
                <label>y</label>
                {{selectedFrame.y}}
            </div>

            <ng-container *ngIf="selectedFrameChildrenStats.contextStart">

                <div>
                    <label>Context</label>

                    {{FrameCategory[selectedFrameChildrenStats.contextStart.frame.category]}} (#{{selectedFrameChildrenStats.contextStart.frame.context}})
                    {{selectedFrameChildrenStats.contextStart.frame.label}}
                </div>

                <div>
                    <label>Time from start of context</label>

                    {{formatTime(selectedFrame.x - selectedFrameChildrenStats.contextStart.x, 3)}}
                </div>
            </ng-container>

            <div>
                <label>Total time</label>

                <ng-container *ngIf="selectedFrame.took">
                    {{formatTime(selectedFrame.took, 3)}}
                </ng-container>

                <ng-container *ngIf="!selectedFrame.took">
                    Pending
                </ng-container>
            </div>

            <ng-container *ngIf="selectedFrame.frame.category === FrameCategory.http">
                <div>
                    <label>Method</label>
                    {{selectedFrameData.method}}
                </div>
                <div>
                    <label>Client IP</label>
                    {{selectedFrameData.clientIp}}
                </div>
                <div>
                    <label>Response Status</label>
                    {{selectedFrameData.responseStatus || 'pending'}}
                </div>
            </ng-container>

            <ng-container *ngIf="selectedFrame.frame.category === FrameCategory.database">
                <div>
                    <label>Entity</label>
                    {{selectedFrameData.className}}
                </div>

                <div style="padding: 10px 0;">
                    <label class="header">SQL</label>
                    <ng-container *ngFor="let item of selectedFrameChildren">
                        <ng-container *ngIf="item.data && item.frame.category === FrameCategory.databaseQuery">
                            <div>
                                {{item.data.sql}}<br/>
                                {{item.data.sqlParams|json}}
                            </div>
                        </ng-container>
                    </ng-container>
                </div>
            </ng-container>

            <ng-container *ngIf="selectedFrame.frame.category === FrameCategory.databaseQuery">
                <div style="padding: 10px 0;">
                    <label class="header">SQL</label>
                    {{selectedFrameData.sql}}<br/>
                    {{selectedFrameData.sqlParams|json}}
                </div>
            </ng-container>

            <ng-container *ngIf="selectedFrameChildren.length">
                <h4 style="margin-top: 10px;">Child frames ({{selectedFrameChildren.length}})</h4>

                <div class="child">
                    <label>Self time</label>
                    <div class="bar">
                        <div class="bg" [style.width.%]="(selectedFrame.took-selectedFrameChildrenStats.totalTime) / selectedFrame.took * 100"></div>
                        <div class="text">
                            {{formatTime(selectedFrame.took - selectedFrameChildrenStats.totalTime, 3)}}
                            ({{(selectedFrame.took - selectedFrameChildrenStats.totalTime) / selectedFrame.took * 100|number:'2.2-2'}}%)
                        </div>
                    </div>
                </div>

                <div class="child" *ngFor="let item of selectedFrameChildren">
                    <label>{{item.frame.label}}</label>
                    <div class="bar">
                        <div class="bg" [style.width.%]="item.took / selectedFrame.took * 100"></div>
                        <div class="text">
                            {{formatTime(item.took, 3)}}
                            ({{item.took / selectedFrame.took * 100|number:'2.2-2'}}%)
                        </div>
                    </div>
                </div>
            </ng-container>
            <!--            <div>-->
            <!--                {{selectedFrameData|json}}-->
            <!--            </div>-->
        </div>
    `,
    styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy, AfterViewInit {
    FrameCategory = FrameCategory;
    formatTime = formatTime;

    protected app = new Application({
        width: 500,
        height: 500,
        antialias: true,
        autoDensity: true,
        transparent: true,
        resolution: window.devicePixelRatio
    });

    protected frameData: FrameData[] = [];

    public selectedFrame?: FrameItem;
    public selectedFrameChildrenStats: { totalTime: number, contextStart?: FrameItem } = { totalTime: 0 };
    public selectedFrameChildren: FrameItem[] = [];
    public selectedFrameData: { [name: string]: any } = {};

    protected viewState = new ViewState();

    public parser = new FrameParser();

    public profiler: ProfilerContainer = new ProfilerContainer(this.parser, this.viewState, this.onSelect.bind(this));

    public frameSub?: Subject<Uint8Array>;

    @ViewChild('canvas', { read: ElementRef }) canvas?: ElementRef;

    constructor(
        protected client: ControllerClient,
        protected cd: ChangeDetectorRef,
    ) {
    }

    timelineSelect(item: FrameItem) {
        this.viewState.scrollX = item.x - this.parser.offsetX;
        this.profiler.viewChanged();
        this.profiler.setSelected(item);
        this.profiler.update();
    }

    onSelect(item?: FrameItem) {
        this.selectedFrame = item;
        this.selectedFrameData = {};

        if (item) {
            for (const data of this.frameData) {
                if (data.id === item.frame.id && data.worker === item.frame.worker) {
                    Object.assign(this.selectedFrameData, data.data);
                }
            }
            this.selectedFrameChildren = [];

            const map: { [id: number]: FrameItem } = {};
            const end = item.x + item.took;

            this.selectedFrameChildrenStats.totalTime = 0;
            this.selectedFrameChildrenStats.contextStart = undefined;

            let contextStartFound: boolean = false;
            const targetY = item.y + 1;

            for (const child of this.profiler.parser.items) {
                if (!child) continue;

                if (!contextStartFound && child.frame.context === item.frame.context && child.frame.worker === item.frame.worker) {
                    contextStartFound = true;
                    this.selectedFrameChildrenStats.contextStart = child;
                }

                if (child.frame.context === item.frame.context
                    && child.frame.worker === item.frame.worker && child.x > item.x && child.x < end && child.y === targetY) {

                    this.selectedFrameChildrenStats.totalTime += child.took;
                    this.selectedFrameChildren.push(child);

                    for (const data of this.frameData) {
                        if (data.id === child.frame.id && data.worker === item.frame.worker) {
                            if (!child.data) child.data = {};
                            Object.assign(child.data, data.data);
                        }
                    }
                }
            }
        }
        // console.log('selectedFrameChildren', this.selectedFrameChildren);
        this.cd.detectChanges();
    }

    ngOnDestroy() {
        this.app.destroy(true);
        if (this.frameSub) this.frameSub.unsubscribe();
    }

    forward() {
        //todo: use this.topLevelFrames
        // console.log('this.viewState', this.viewState);
        for (const frame of this.profiler.parser.rootItems) {
            if (this.selectedFrame && frame.x <= this.selectedFrame.x) continue;
            if (frame.x > this.viewState.scrollX) {
                this.viewState.scrollX = frame.x - this.parser.offsetX;
                this.profiler.viewChanged();
                this.profiler.setSelected(frame);
                this.profiler.update();
                return;
            }
        }
        // this.profiler.forward();
    }

    @HostListener('window:resize')
    onResize() {
        if (!this.canvas) return;

        this.app.renderer.resize(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);
        this.viewState.width = this.canvas.nativeElement.clientWidth;
        this.viewState.height = this.canvas.nativeElement.clientHeight;
        this.profiler.update();
    }

    async ngAfterViewInit() {
        this.createCanvas();
        await this.loadFrames();
        this.cd.detectChanges();
    }

    async ngOnInit() {
    }

    protected async loadFrames() {

        console.time('download');
        const framesBuffer = await this.client.debug.getProfilerFrames();
        const dataBuffer = await this.client.debug.getProfilerFrameData();
        console.timeEnd('download');

        console.time('parse');
        const frames = decodeFrames(framesBuffer);
        this.frameData = decodeFrameData(dataBuffer);
        console.timeEnd('parse');

        // console.log('this.frames', frames);
        // console.log('this.frameData', this.frameData);

        //todo: implement automatic slicing based on offsetX
        // load frameData depending on the selected frames
        // this.profiler.addFrames(this.frames);
        console.time('addFrames');
        this.profiler.addFrames(frames);
        console.timeEnd('addFrames');
        this.profiler.update();

        const frameSub = this.frameSub = await this.client.debug.subscribeStopwatch();
        frameSub.subscribe((next) => {
            console.log('got frames', next, decodeFrames(next));
            this.profiler.addFrames(decodeFrames(next));
            this.profiler.update();
        });
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

        this.app.stage.addChild(this.profiler);

        const mc = new Hammer.Manager(this.app.renderer.view);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

        let offsetXStart = 0;
        mc.on('panstart', () => {
            offsetXStart = this.viewState.scrollX;
            this.profiler.ignoreNextClick = true;
        });
        mc.on('panend', () => {
            offsetXStart = this.viewState.scrollX;
        });

        mc.on('pan', (ev) => {
            if (ev.deltaX === 0) return;
            this.viewState.scrollX = offsetXStart - (ev.deltaX * this.viewState.zoom);
            this.profiler.viewChanged();
        });

        this.app.renderer.view.addEventListener('wheel', (event) => {
            const newZoom = Math.min(1000000, Math.max(0.1, this.viewState.zoom - (Math.min(event.deltaY * -1 / 500, 0.3) * this.viewState.zoom)));
            const ratio = newZoom / this.viewState.zoom;

            const eventOffsetX = event.clientX - this.app.renderer.view.getBoundingClientRect().x;
            this.viewState.scrollX -= (eventOffsetX) * this.viewState.zoom * (ratio - 1);
            this.viewState.zoom = newZoom;

            this.profiler.viewChanged();
        });
    }
}
