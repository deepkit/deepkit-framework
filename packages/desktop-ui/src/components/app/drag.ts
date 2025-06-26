import { Directive, input, output } from '@angular/core';
import { injectElementRef } from './utils';

export interface DuiDragEvent {
    id: number;
    target?: PointerEvent['target'];
    deltaX: number;
    deltaY: number;
    clientX: number;
    clientY: number;
}

export interface DuiDragStartEvent extends DuiDragEvent {
    /**
     * If this is set to false, the drag will not be accepted.
     */
    accept: boolean;
}

/**
 * A directive that catches pointer events and emits drag events.
 *
 * This won't move the element, it just emits events when the user does a drag gesture.
 *
 * ```html
 * <div (duiDrag)="onDrag($event)" [duiDragThreshold]="2"></div>
 * ```
 */
@Directive({
    selector: '[duiDrag]',
})
export class DragDirective {
    protected element = injectElementRef();
    protected id = 0;

    duiDragThreshold = input(0);
    duiDragAbortOnEscape = input(true);

    duiDrag = output<DuiDragEvent>();
    duiDragStart = output<DuiDragStartEvent>();
    duiDragEnd = output<DuiDragEvent>();
    duiDragCancel = output<number>();

    protected startX = 0;
    protected startY = 0;
    protected dragging = false;
    protected draggingElement?: DuiDragEvent['target'];
    protected controller?: AbortController;
    protected destroy = new AbortController();

    constructor() {
        this.element.nativeElement.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal: this.destroy.signal });
    }

    protected onPointerDown(e: PointerEvent) {
        if (!this.duiDragThreshold()) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.button !== 0) return;

        this.startX = e.clientX;
        this.startY = e.clientY;
        this.dragging = false;

        const el = this.element.nativeElement;
        el.setPointerCapture(e.pointerId);
        const id = ++this.id;

        this.controller?.abort();
        this.controller = new AbortController();
        const signal = this.controller.signal;
        const threshold = this.duiDragThreshold() * this.duiDragThreshold();
        this.draggingElement = e.target;

        const onMove = (event: PointerEvent) => {
            const dx = event.clientX - this.startX;
            const dy = event.clientY - this.startY;

            if (!this.dragging) {
                const start = threshold ? dx * dx + dy * dy >= threshold : true;
                if (start) {
                    const eventObject: DuiDragStartEvent = {
                        id,
                        accept: true,
                        target: this.draggingElement,
                        deltaX: dx,
                        deltaY: dy,
                        clientX: event.clientX,
                        clientY: event.clientY,
                    };
                    this.duiDragStart.emit(eventObject);
                    this.dragging = eventObject.accept;
                    if (!eventObject.accept) {
                        this.abort(id);
                        return;
                    }
                }
            }

            if (this.dragging) {
                this.duiDrag.emit({
                    id,
                    target: this.draggingElement,
                    deltaX: dx,
                    deltaY: dy,
                    clientX: event.clientX,
                    clientY: event.clientY,
                });
            }
        };

        const onUp = (event: PointerEvent) => {
            el.releasePointerCapture(event.pointerId);
            this.controller?.abort();

            if (this.dragging) {
                const dx = event.clientX - this.startX;
                const dy = event.clientY - this.startY;
                this.duiDragEnd.emit({
                    id,
                    target: this.draggingElement,
                    deltaX: dx,
                    deltaY: dy,
                    clientX: event.clientX,
                    clientY: event.clientY,
                });
            }
        };

        const onKey = (event: KeyboardEvent) => {
            if (!this.dragging) return;
            if (event.key === 'Escape') {
                el.releasePointerCapture(e.pointerId);
                this.controller?.abort();
                this.duiDragCancel.emit(id);
            }
        };

        window.addEventListener('pointermove', onMove, { signal });
        window.addEventListener('pointerup', onUp, { signal });
        if (this.duiDragAbortOnEscape()) {
            window.addEventListener('keydown', onKey, { signal });
        }
    }

    protected abort(id: number) {
        this.controller?.abort();
        this.controller = undefined;
        this.draggingElement = undefined;
        if (this.dragging) {
            this.duiDragCancel.emit(id);
        }
        this.dragging = false;
    }

    ngOnDestroy() {
        this.controller?.abort();
        this.destroy.abort();
    }
}
