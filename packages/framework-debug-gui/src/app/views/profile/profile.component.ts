import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ControllerClient } from '../../client';
import { decodeFrames } from '@deepkit/framework-debug-api';
import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { FrameCategory, FrameEnd, FrameStart, FrameType } from '@deepkit/stopwatch';
import * as Hammer from 'hammerjs';

class ViewState {
    scrollX: number = 0;
    zoom: number = 20;
    width: number = 500;
    scrollWidth: number = 1;
}

export const frameColors: {[type in FrameCategory]: {border: number, bg: number}} = {
    [FrameCategory.none]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.cli]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.database]: {border: 0x737DAB, bg: 0x49497A},
    [FrameCategory.email]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.event]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.function]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.http]: {border: 0x7392AB, bg: 0x496C7A},
    [FrameCategory.job]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.lock]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.rpc]: {border: 0x73AB77, bg: 0x497A4C},
    [FrameCategory.template]: {border: 0xAF9C42, bg: 0x8D7522},
    [FrameCategory.workflow]: {border: 0x73AB77, bg: 0x497A4C},
};

function formatTime(microseconds: number): string {
    if (microseconds === 0) return '0';
    if (Math.abs(microseconds) < 1_000) return parseFloat(microseconds.toFixed(1)) + 'µs';
    if (Math.abs(microseconds) < 1_000_000) return parseFloat((microseconds / 1000).toFixed(1)) + 'ms';
    return parseFloat((microseconds / 1000 / 1000).toFixed(1)) + 's';
}

class FrameContainer extends Container {
    protected rectangle: Graphics;
    mask: Sprite;

    protected textStyle = {
        fontSize: 12,
        fill: 0xffffff
    };

    constructor(
        public frame: { id: number, category: FrameCategory, context: number, y: number, label: string, x: number, took: number },
        public offset: number,
        public viewState: ViewState,
    ) {
        super();
        this.rectangle = new Graphics();
        this.drawBg();

        const text = new Text(frame.label, this.textStyle);
        text.y = 3.5;
        text.x = 3.5;
        this.updatePosition();
        this.addChild(this.rectangle, text);

        this.interactive = true;

        let hoverMenu: Container | undefined;

        this.addListener('mouseover', (event) => {
            if (hoverMenu) return;

            hoverMenu = new Container();
            const message = new Text(this.frame.label, this.textStyle);
            hoverMenu.addChild(message);

            hoverMenu.x = event.data.global.x;
            hoverMenu.y = event.data.global.y;
            this.parent.addChild(hoverMenu);
        });

        this.addListener('mousemove', (event) => {
            if (!hoverMenu) return;
            hoverMenu.x = event.data.global.x;
            hoverMenu.y = event.data.global.y;
        });

        this.addListener('mouseout', (event) => {
            if (!hoverMenu) return;
            this.parent.removeChild(hoverMenu);
            hoverMenu = undefined;
        });

        this.mask = new Sprite(Texture.WHITE);
        this.mask.width = this.width;
        this.mask.height = this.height;
        this.addChild(this.mask);
    }

    get frameWidth(): number {
        return this.frame.took / this.viewState.zoom;
    }

    protected updatePosition() {
        const x = (this.frame.x - this.offset - this.viewState.scrollX) / this.viewState.zoom;
        this.x = x + .5;
        this.y = (this.frame.y * 25) + 0.5;
    }

    protected drawBg() {
        this.rectangle.clear();
        this.rectangle.beginFill(frameColors[this.frame.category].bg);
        this.rectangle.lineStyle(1, frameColors[this.frame.category].border);
        this.rectangle.drawRect(0, 0, this.frameWidth, 20);
        this.rectangle.endFill();
    }

    update() {
        this.updatePosition();
        this.drawBg();
        this.mask.width = this.frameWidth;
        this.mask.height = 20;
    }
}

class ProfilerContainer extends Container {
    protected headerLines = new Graphics();
    protected headerText = new Container();
    protected frameContainer = new Container();
    protected containers: FrameContainer[] = [];
    protected offsetText: Text;
    protected textStyle = { fontSize: 12, fill: 0xdddddd } as TextStyle;

    protected offsetX: number = 0; //where the first frame starts. We place all boxes accordingly, so `0` starts here.

    constructor(public viewState: ViewState) {
        super();
        this.addChild(this.headerLines);
        this.addChild(this.headerText);
        this.addChild(this.frameContainer);
        this.offsetText = new Text('0', this.textStyle);
        this.addChild(this.offsetText);
        this.offsetText.x = 0;
        this.offsetText.y = 13;

        this.frameContainer.y = 15;
    }

    addFrames(frames: (FrameStart | FrameEnd)[]) {
        const framesMap: { id: number, context: number, category: FrameCategory, y: number, label: string, x: number, took: number }[] = [];
        const contextMap: { y: number }[] = [];

        for (const frame of frames) {
            if (frame.type === FrameType.start) {
                if (!this.offsetX) this.offsetX = frame.timestamp;
                if (!contextMap[frame.context]) contextMap[frame.context] = { y: 0 };
                contextMap[frame.context].y++;
                framesMap.push({ id: frame.id, category: frame.category, context: frame.context, y: contextMap[frame.context].y, label: frame.label, x: frame.timestamp, took: 0 });
            } else {
                const f = framesMap[frame.id - 1];
                if (!f || f.id !== frame.id) {
                    throw new Error(`Frame end #${frame.id} not in framesMap`);
                }
                contextMap[f.context].y--;
                f.took = frame.timestamp - f.x;
                if (this.viewState.scrollWidth < frame.timestamp - this.offsetX) this.viewState.scrollWidth = frame.timestamp - this.offsetX;
            }
        }

        // console.log('frames', [...framesMap.values()]);
        for (const frame of framesMap) {
            const container = new FrameContainer(frame, this.offsetX, this.viewState);
            this.containers.push(container);

            this.frameContainer.addChild(container);
        }
    }

    forward() {
        let lastX = this.viewState.scrollX;
        for (const frame of this.frameContainer.children as FrameContainer[]) {
            if (frame.frame.x-this.offsetX > lastX) {
                lastX = frame.frame.x - this.offsetX;
                break;
            }
        }

        this.viewState.scrollX = lastX;
        this.update();
    }

    update() {
        for (const layer of this.containers) {
            layer.update();
        }
        this.renderHeaderLines();
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
        </dui-window-toolbar>
    `,
    styles: [`
        :host {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
        }
    `]
})
export class ProfileComponent implements OnInit, OnDestroy {
    protected app = new Application({
        width: 500,
        height: 500,
        antialias: true,
        autoDensity: true,
        transparent: true,
        resolution: window.devicePixelRatio
    });

    protected viewState = new ViewState();
    protected profiler = new ProfilerContainer(this.viewState);

    constructor(
        protected client: ControllerClient,
        protected host: ElementRef<HTMLElement>,
    ) {
    }

    ngOnDestroy() {
        this.app.destroy(true);
    }

    forward() {
        this.profiler.forward();
    }

    @HostListener('window:resize')
    onResize() {
        // this.app.renderer.resize(this.host.nativeElement.clientWidth, this.host.nativeElement.clientHeight);
        // this.viewState.width = this.host.nativeElement.clientWidth;
        // this.profiler.update();
    }

    async ngOnInit() {
        // The application will create a canvas element for you that you
        // can then insert into the DOM.
        this.host.nativeElement.appendChild(this.app.view);
        this.app.renderer.view.style.position = 'absolute';
        this.app.renderer.view.style.display = 'block';
        this.app.renderer.view.style.width = '100%';
        this.app.renderer.view.style.height = '100%';
        this.app.renderer.resize(this.host.nativeElement.clientWidth, this.host.nativeElement.clientHeight);

        const buffer = await this.client.debug.getProfilerFrames();
        const frames = decodeFrames(buffer);

        this.viewState.width = this.host.nativeElement.clientWidth;
        //todo: implement automatic slicing based on offsetX
        this.profiler.addFrames(frames.slice(0, 100));
        this.profiler.update();

        this.app.stage.addChild(this.profiler);

        const mc = new Hammer.Manager(this.app.renderer.view);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

        let offsetXStart = 0;
        mc.on('panstart', () => {
            offsetXStart = this.viewState.scrollX;
        });

        mc.on('pan', (ev) => {
            this.viewState.scrollX = offsetXStart - (ev.deltaX * this.viewState.zoom);
            this.profiler.update();
        });

        this.app.renderer.view.addEventListener('wheel', (event) => {
            const newZoom = Math.min(1000000, Math.max(0.1, this.viewState.zoom - (Math.min(event.deltaY * -1 / 500, 0.3) * this.viewState.zoom)));
            const ratio = newZoom / this.viewState.zoom;

            const eventOffsetX = event.clientX - this.app.renderer.view.getBoundingClientRect().x;
            this.viewState.scrollX -= (eventOffsetX) * this.viewState.zoom * (ratio - 1);
            this.viewState.zoom = newZoom;

            this.profiler.update();
        });
    }

}
