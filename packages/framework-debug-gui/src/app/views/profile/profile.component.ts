import { Component, ElementRef, OnInit } from '@angular/core';
import { ControllerClient } from '../../client';
import { decodeFrames } from '@deepkit/framework-debug-api';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { FrameType } from '@deepkit/stopwatch';
import * as Hammer from 'hammerjs';

class FrameContainer extends Container {
    protected rectangle: Graphics;

    constructor(
        public frame: { id: number, context: number, y: number, label: string, start: number, took: number },
        public offset: number,
        public zoom: number,
        public scrollX: number,
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

    updatePosition(scrollX?: number) {
        if (scrollX !== undefined) this.scrollX = scrollX;
        const x = (this.frame.start - this.offset - this.scrollX) / this.zoom;
        this.x = x + .5;
        this.y = (this.frame.y * 25) + 0.5;
    }

    protected drawBg() {
        this.rectangle.clear();
        this.rectangle.beginFill(0x497A4C);
        this.rectangle.lineStyle(1, 0x73AB77);
        this.rectangle.drawRect(0, 0, this.frame.took / this.zoom, 20);
        this.rectangle.endFill();
    }

    setZoom(zoom: number) {
        this.zoom = zoom;
        this.updatePosition();
        this.drawBg();
    }

    update() {
        this.updatePosition();
        this.drawBg();
    }
}

@Component({
    template: `
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

    protected containers: FrameContainer[] = [];

    constructor(
        protected client: ControllerClient,
        protected host: ElementRef<HTMLElement>,
    ) {
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
        console.log('frames', frames);

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

        let zoom = 100;
        let scrollX = 0;

        for (const frame of framesMap) {
            const container = new FrameContainer(frame, offset, zoom, scrollX);
            this.containers.push(container);

            this.app.stage.addChild(container);
        }

        const mc = new Hammer.Manager(this.app.renderer.view);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

        mc.on('panend', (ev) => {
            scrollX -= ev.deltaX * zoom;
        });

        mc.on('pan', (ev) => {
            for (const layer of this.containers) {
                layer.updatePosition(scrollX - (ev.deltaX * zoom));
            }
        });

        this.app.renderer.view.addEventListener('wheel', (event) => {
            const newZoom = zoom - (Math.min(event.deltaY / 100, 0.5) * zoom);
            const ratio = newZoom / zoom;
            scrollX *= ratio;
            zoom = newZoom;
            for (const layer of this.containers) {
                layer.zoom = zoom;
                layer.scrollX = scrollX;
                layer.update();
            }
        });
    }

}
