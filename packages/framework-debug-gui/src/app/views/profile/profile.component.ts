import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { ControllerClient } from '../../client';
import { decodeFrames } from '@deepkit/framework-debug-api';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { FrameEnd, FrameStart, FrameType } from '@deepkit/stopwatch';
import * as Hammer from 'hammerjs';

class ViewState {
    scrollX: number = 0;
    zoom: number = 1;
    width: number = 500;
}

class FrameContainer extends Container {
    protected rectangle: Graphics;

    constructor(
        public frame: { id: number, context: number, y: number, label: string, start: number, took: number },
        public offset: number,
        public viewState: ViewState,
    ) {
        super();
        this.rectangle = new Graphics();
        this.drawBg();

        const text = new Text(frame.label, {
            fontSize: 12,
            fill: 0xffffff
        });
        text.y = 3.5;
        text.x = 3.5;
        this.updatePosition();
        this.addChild(this.rectangle, text);
    }

    protected updatePosition() {
        const x = (this.frame.start - this.offset - this.viewState.scrollX) / this.viewState.zoom;
        this.x = x + .5;
        this.y = (this.frame.y * 25) + 0.5;
    }

    protected drawBg() {
        this.rectangle.clear();
        this.rectangle.beginFill(0x497A4C);
        this.rectangle.lineStyle(1, 0x73AB77);
        this.rectangle.drawRect(0, 0, this.frame.took / this.viewState.zoom, 20);
        this.rectangle.endFill();
    }

    update() {
        this.updatePosition();
        this.drawBg();
    }
}

class ProfilerContainer extends Container {
    protected headerLines = new Graphics();
    protected headerText = new Container();
    protected frameContainer = new Container();
    protected containers: FrameContainer[] = [];

    constructor(public viewState: ViewState) {
        super();
        this.addChild(this.headerLines);
        this.addChild(this.headerText);
        this.addChild(this.frameContainer);
        this.frameContainer.y = 15;
    }

    addFrames(frames: (FrameStart | FrameEnd)[]) {
        const framesMap: { id: number, context: number, y: number, label: string, start: number, took: number }[] = [];
        const contextMap: { y: number }[] = [];
        let offset: number = 0;

        for (const frame of frames) {
            if (frame.type === FrameType.start) {
                if (!offset) offset = frame.timestamp;
                if (!contextMap[frame.context]) contextMap[frame.context] = { y: 0 };
                contextMap[frame.context].y++;
                framesMap.push({ id: frame.id, context: frame.context, y: contextMap[frame.context].y, label: frame.label, start: frame.timestamp, took: 0 });
            } else {
                const f = framesMap[frame.id - 1];
                if (!f || f.id !== frame.id) {
                    throw new Error(`Frame end #${frame.id} not in framesMap`);
                }
                contextMap[f.context].y--;
                f.took = frame.timestamp - f.start;
            }
        }

        // console.log('frames', [...framesMap.values()]);
        for (const frame of framesMap) {
            const container = new FrameContainer(frame, offset, this.viewState);
            this.containers.push(container);

            this.frameContainer.addChild(container);
        }
    }

    forward() {
        let lastX = 0;
        for (const frame of this.frameContainer.children as FrameContainer[]) {
            if (frame.x > lastX) lastX = frame.x;
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
        this.headerText.x = this.headerLines.x = -this.viewState.scrollX / this.viewState.zoom;

        let padding = 10 / this.viewState.zoom;
        while (padding < 5) padding *= 2;

        const jumpSize = 10 * padding;
        const jumps = Math.abs(Math.ceil(this.headerLines.x / jumpSize) - 1);

        if (this.viewState.scrollX >= jumpSize) {
            this.headerLines.x = this.headerLines.x % (10 * padding);
            this.headerText.x = this.headerText.x % (10 * padding);
        }

        this.headerLines.clear();
        this.headerLines.lineStyle(1, 0xffffff, 0.7);

        for (const text of this.headerText.children) {
            text.visible = false;
        }

        const maxLines = (this.viewState.width + jumpSize) / padding;

        for (let i = 0; i < maxLines; i++) {
            const x = (i * padding);
            this.headerLines.moveTo(x, 0);
            this.headerLines.lineStyle(i % 10 === 0 ? 2 : 1, 0xffffff, 0.7);
            this.headerLines.lineTo(x, i % 10 === 0 ? 12 : i % 5 === 0 ? 7 : 5);

            const v = x + (this.viewState.scrollX >= jumpSize ? ((jumps - 1) * jumpSize) : 0);
            if (i % 10 === 0 && v >= 0) {
                let text = this.headerText.children[i] as Text;
                if (!this.headerText.children[i]) {
                    text = new Text(this.formatTime(v * this.viewState.zoom), { fontSize: 12, fill: 0xdddddd } as TextStyle);
                    this.headerText.addChild(text);
                }
                text.x = x;
                text.y = 13;
                text.visible = true;
                text.text = this.formatTime(v * this.viewState.zoom);
            }
        }
    }

    protected formatTime(microseconds: number): string {
        if (microseconds === 0) return '0';
        if (microseconds < 10_000) return Math.round(microseconds) + 'µs';
        if (microseconds < 10_000_000) return Math.round(microseconds / 1000) + 'ms';
        return Math.round(microseconds / 1000 / 1000) + 's';
    }
}

@Component({
    template: `
        <dui-window-toolbar for="main">
            <dui-button-group>
                <dui-button icon="play" (click)="forward()"></dui-button>
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
export class ProfileComponent implements OnInit {
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

    forward() {
        this.profiler.forward();
    }

    @HostListener('window:resize')
    onResize() {
        this.app.renderer.resize(this.host.nativeElement.clientWidth, this.host.nativeElement.clientHeight);
        this.viewState.width = this.host.nativeElement.clientWidth;
        this.profiler.update();
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
        this.profiler.addFrames(frames);
        this.profiler.update();

        this.app.stage.addChild(this.profiler);

        const mc = new Hammer.Manager(this.app.renderer.view);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

        let offsetXStart = 0;
        mc.on('panstart', () => {
            offsetXStart = this.viewState.scrollX;
        });

        mc.on('pan', (ev) => {
            // console.log('pan', this.viewState.scrollX, ev);
            this.viewState.scrollX = offsetXStart - (ev.deltaX * this.viewState.zoom);
            this.profiler.update();
        });

        this.app.renderer.view.addEventListener('wheel', (event) => {
            const newZoom = Math.min(1000000, Math.max(1, this.viewState.zoom - (Math.min(event.deltaY * -1 / 500, 0.3) * this.viewState.zoom)));
            const ratio = newZoom / this.viewState.zoom;
            this.viewState.scrollX *= ratio;

            // const eventOffsetX = event.clientX - this.app.renderer.view.getBoundingClientRect().x;
            // const t = eventOffsetX * this.viewState.zoom + this.viewState.scrollX;
            // const scrollXOffset = t - (t * ratio);
            // this.viewState.scrollX += scrollXOffset;

            this.viewState.zoom = newZoom;

            this.profiler.update();
        });
    }

}
