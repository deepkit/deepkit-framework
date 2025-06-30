import { Directive, input, output } from '@angular/core';
import { injectElementRef, registerEventListener, RegisterEventListenerRemove } from './utils';

export interface DuiDragEvent extends PointerEvent {
    id: number;
    deltaX: number;
    deltaY: number;
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

    protected destroy: RegisterEventListenerRemove;
    protected removePointerMove?: RegisterEventListenerRemove;
    protected removePointerUp?: RegisterEventListenerRemove;
    protected removeKeyUp?: RegisterEventListenerRemove;

    constructor() {
        this.destroy = registerEventListener(this.element.nativeElement, 'pointerdown', (e) => this.onPointerDown(e));
    }

    protected onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return;
        e.stopPropagation();

        this.startX = e.clientX;
        this.startY = e.clientY;
        this.dragging = false;

        const el = this.element.nativeElement;
        el.setPointerCapture(e.pointerId);
        const id = ++this.id;

        this.dragging = false;
        const threshold = this.duiDragThreshold() * this.duiDragThreshold();
        this.draggingElement = e.target;

        const onMove = (event: PointerEvent) => {
            const dx = event.clientX - this.startX;
            const dy = event.clientY - this.startY;

            if (!this.dragging) {
                const start = threshold ? dx * dx + dy * dy >= threshold : true;
                if (start) {
                    const startEvent: DuiDragStartEvent = Object.assign(event, {
                        id,
                        accept: true,
                        deltaX: dx,
                        deltaY: dy,
                    });
                    this.duiDragStart.emit(startEvent);
                    this.dragging = startEvent.accept;
                    if (!startEvent.accept) {
                        this.abort(id);
                        return;
                    }
                }
            }

            if (this.dragging) {
                const dragEvent: DuiDragEvent = Object.assign(event, {
                    id,
                    deltaX: dx,
                    deltaY: dy,
                });
                this.duiDrag.emit(dragEvent);
            }
        };

        const onUp = (event: PointerEvent) => {
            el.releasePointerCapture(event.pointerId);
            this.release();

            if (this.dragging) {
                this.dragging = false;
                event.stopPropagation();
                const dx = event.clientX - this.startX;
                const dy = event.clientY - this.startY;
                const dragEndEvent: DuiDragEvent = Object.assign(event, {
                    id,
                    deltaX: dx,
                    deltaY: dy,
                });
                this.duiDragEnd.emit(dragEndEvent);
                this.element.nativeElement.addEventListener('click', (up) => up.stopPropagation(), { capture: true, once: true });
            }
        };

        const onKey = (event: KeyboardEvent) => {
            if (!this.dragging) return;
            event.stopPropagation();
            if (event.key === 'Escape') {
                el.releasePointerCapture(e.pointerId);
                this.dragging = false;
                this.release();
                this.duiDragCancel.emit(id);
            }
        };

        this.removePointerMove = registerEventListener(window, 'pointermove', onMove);
        this.removePointerUp = registerEventListener(window, 'pointerup', onUp, { once: true });
        if (this.duiDragAbortOnEscape()) {
            this.removeKeyUp = registerEventListener(window, 'keydown', onKey);
        }
    }

    protected release() {
        this.removePointerMove?.();
        this.removePointerUp?.();
        this.removeKeyUp?.();
    }

    protected abort(id: number) {
        this.release();
        this.draggingElement = undefined;
        if (this.dragging) {
            this.duiDragCancel.emit(id);
        }
        this.dragging = false;
    }

    ngOnDestroy() {
        this.removePointerMove?.();
        this.removePointerUp?.();
        this.removeKeyUp?.();
        this.destroy();
    }
}
