import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from "@angular/core";
import { Observable, Subscription } from "rxjs";
import { detectChangesNextFrame } from "./utils";

/**
 * Almost the same as |async pipe, but renders directly (detectChanges() instead of marking it only(markForCheck())
 * on ChangeDetectorRef.
 */
@Pipe({ name: 'asyncRender', pure: false })
export class AsyncRenderPipe implements OnDestroy, PipeTransform {
    protected subscription?: Subscription;
    protected lastValue?: any;
    protected lastReturnedValue?: any;

    constructor(
        protected cd: ChangeDetectorRef) {
    }

    ngOnDestroy(): void {
        if (this.subscription) this.subscription.unsubscribe();
    }

    transform<T>(value?: Observable<T>): T | undefined {
        if (this.lastValue !== value) {
            if (this.subscription) this.subscription.unsubscribe();
            this.lastReturnedValue = undefined;
            this.lastValue = value;

            if (value) {
                this.subscription = value.subscribe((next) => {
                    this.lastReturnedValue = next;
                    detectChangesNextFrame(this.cd);
                });
            }
        }

        return this.lastReturnedValue;
    }
}
