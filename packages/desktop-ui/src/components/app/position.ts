import { Directive, OnDestroy, OnInit, output } from '@angular/core';
import { injectElementRef } from './utils';

export type PositionObserverDisconnect = () => void;

export function observePosition(
    element: Element,
    callback: (entry: DOMRectReadOnly) => void,
    debugPosition = false,
): PositionObserverDisconnect {
    if ('undefined' === typeof IntersectionObserver) return () => undefined;
    let lastObserver: IntersectionObserver | undefined;

    const resizeObserver = new ResizeObserver(() => {
        setupObserver();
    });
    resizeObserver.observe(element);
    const debug = debugPosition ? document.createElement('div') : undefined;
    if (debug) {
        debug.style.position = 'fixed';
        debug.style.zIndex = '999999';
        debug.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        debug.style.pointerEvents = 'none';
        document.body.appendChild(debug);
    }

    function setupObserver() {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) {
            return;
        }
        const vw = document.body.clientWidth;
        const vh = window.innerHeight;
        const top = Math.floor(box.top);
        const left = Math.floor(box.left);
        const right = Math.floor(vw - box.right);
        const bottom = Math.floor(vh - box.bottom);

        const rootMargin = `${-top}px ${-right}px ${-bottom}px ${-left}px`;
        if (debug) {
            debug.style.top = `${top}px`;
            debug.style.left = `${left}px`;
            debug.style.right = `${right}px`;
            debug.style.bottom = `${bottom}px`;
        }

        const size = box.width > box.height ? box.width : box.height;
        const onePixelInPercent = 1 / size;

        // To not create a new IntersectionObserver every event, we use several thresholds.
        // To not create too many thresholds (when the element is very big),
        // we generate 100 items, each the size of one pixel in percent.
        // In the callback we rebuild a new observer when intersectionRatio is
        // either bigger than the biggest threshold or smaller than the smallest threshold.
        const thresholdCount = Math.min(size, 100);
        const thresholds = Array.from({ length: thresholdCount }, (_, i) => 1 - ((i + 1) * onePixelInPercent));
        // console.log('rootMargin', rootMargin, box, thresholds);
        const minRatio = thresholds[thresholds.length - 1];

        if (lastObserver) lastObserver.disconnect();
        lastObserver = new IntersectionObserver(
            (entries, observer) => {
                for (const entry of entries) {
                    callback(entry.boundingClientRect);
                }
                if (entries[0].intersectionRatio <= minRatio) {
                    observer.disconnect();
                    setupObserver();
                }
            },
            { root: null, rootMargin, threshold: thresholds },
        );
        lastObserver.observe(element);
    }

    setupObserver();

    return () => {
        lastObserver?.disconnect();
        lastObserver = undefined;
        resizeObserver.disconnect();
        if (debug) {
            debug.remove();
        }
    };
}

@Directive({
    selector: '[duiPositionChange]',
})
export class PositionChangeDirective implements OnInit, OnDestroy {
    duiPositionChange = output<any>();

    elementRef = injectElementRef();
    observer = observePosition(this.elementRef.nativeElement, (rect) => {
        this.duiPositionChange.emit(rect);
    });

    ngOnInit() {
    }

    ngOnDestroy() {
        this.observer();
    }
}
