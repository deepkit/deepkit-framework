import { ApplicationRef, ChangeDetectorRef, Directive, ElementRef, HostListener, Input, OnChanges } from "@angular/core";
import { Electron } from "../../core/utils";


@Directive({
    selector: '[openExternal], a[href]',
})
export class OpenExternalDirective implements OnChanges {
    @Input('openExternal') private openExternal: string = '';
    @Input('href') private href: string = '';

    constructor(private element: ElementRef) {
        // this.element.nativeElement.href = '#';
    }

    ngOnChanges(): void {
        // this.element.nativeElement.href = this.getLink();
    }

    getLink() {
        return this.openExternal || this.href;
    }

    @HostListener('click', ['$event'])
    onClick(event: Event) {
        event.stopPropagation();
        event.preventDefault();

        if (Electron.isAvailable()) {
            event.preventDefault();
            Electron.getRemote().shell.openExternal(this.getLink());
        } else {
            window.open(this.getLink(), '_blank');
        }
    }
}

let lastScheduleResize: any;

export function scheduleWindowResizeEvent() {
    if (lastScheduleResize) cancelAnimationFrame(lastScheduleResize);
    lastScheduleResize = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        lastScheduleResize = undefined;
    })
}


let lastFrameRequest: any;
let lastFrameRequestStack = new Set<ChangeDetectorRef>();

export class ZonelessChangeDetector {
    static app: ApplicationRef | undefined = undefined;

    static getApp() {
        if (!ZonelessChangeDetector.app) {
            throw new Error('ZonelessChangeDetector.app not set yet');
        }

        return ZonelessChangeDetector.app;
    }
}

/**
 * This handy function makes sure that in the next animation frame the given ChangeDetectorRef is called.
 * It makes automatically sure that it is only called once per frame.
 */
export function detectChangesNextFrame(cd?: ChangeDetectorRef) {
    if (cd) {
        lastFrameRequestStack.add(cd);
    }

    if (lastFrameRequest) {
        return;
    }

    lastFrameRequest = requestAnimationFrame(() => {
        lastFrameRequest = undefined;
        for (const i of lastFrameRequestStack) {
            i.markForCheck();
        }
        //since ivy we have to use tick() instead of and can not use i.detectChanges().
        ZonelessChangeDetector.getApp().tick();
        lastFrameRequestStack.clear();
    });
}
