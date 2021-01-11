import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, Output } from "@angular/core";
import Hammer from 'hammerjs';

@Component({
    selector: 'dui-splitter',
    template: '',
    styleUrls: ['./splitter.component.scss'],
    host: {
        '[class.splitter-right]': 'position === "right"',
        '[class.splitter-left]': 'position === "left"',
        '[class.splitter-top]': 'position === "top"',
        '[class.splitter-bottom]': 'position === "bottom"',
        '[class.splitter-with-indicator]': 'indicator !== false',
    }
})
export class SplitterComponent implements AfterViewInit {
    @Output() modelChange = new EventEmitter<number>();

    @Input() indicator: boolean | '' = false;

    @Input() position: 'right' | 'left' | 'top' | 'bottom' = 'right';

    @Input() element?: HTMLElement;

    constructor(
        private host: ElementRef,
        private zone: NgZone,
    ) {
    }

    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(() => {
            const mc = new Hammer(this.host.nativeElement);
            mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 }));

            let start: number = 0;

            this.host.nativeElement.addEventListener('pointerdown', (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
            });

            this.host.nativeElement.addEventListener('pointermove', (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
            });

            mc.on('panstart', (event: HammerInput) => {
                if (this.position === 'right' || this.position === 'left') {
                    start = (this.element ? this.element.clientWidth : this.host.nativeElement!.parentElement.clientWidth);
                } else {
                    start = (this.element ? this.element.clientHeight : this.host.nativeElement!.parentElement.clientHeight);
                }
            });

            let lastAnimationFrame: any;
            mc.on('pan', (event: HammerInput) => {
                if (lastAnimationFrame) {
                    cancelAnimationFrame(lastAnimationFrame);
                }

                lastAnimationFrame = requestAnimationFrame(() => {
                    if (this.element) {
                        this.element.style.width = (start + event.deltaX) + 'px';
                    }

                    if (this.position === 'right') {
                        this.modelChange.emit(start + event.deltaX);
                        this.triggerWindowResize();
                    } else if (this.position === 'left') {
                        this.modelChange.emit(start - event.deltaX);
                        this.triggerWindowResize();
                    } else if (this.position === 'top') {
                        this.modelChange.emit(start - event.deltaY);
                        this.triggerWindowResize();
                    } else if (this.position === 'bottom') {
                        this.modelChange.emit(start + event.deltaY);
                        this.triggerWindowResize();
                    }
                });
            })
        });
    }

    protected triggerWindowResize() {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }
}
