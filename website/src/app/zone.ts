import {
    ApplicationRef,
    EventEmitter,
    importProvidersFrom,
    inject,
    Injectable,
    Injector,
    ModuleWithProviders,
    NgModule,
    NgZone,
    Optional,
    RendererFactory2,
} from '@angular/core';
import { clearTick, nextTick } from '@deepkit/core';
import { ActivationEnd, NavigationEnd, Router } from '@angular/router';

function patch(functionName: string, prototype: { [name: string]: any }) {
    const def = Object.getOwnPropertyDescriptor(prototype, functionName);
    if (!def || def.get) return;
    const ori: any = prototype[functionName];
    if (!ori || 'function' !== typeof ori) return;
    // console.log('patch ngOnInit', getClassName(type.type));
    prototype[functionName] = function (...args: any[]) {
        const res = ori.apply(this, args);
        if (res instanceof Promise) {
            // console.log('patched function', getClassName(prototype), functionName, res instanceof Promise, !!this.__ngZone);
            if (this.__ngZone) {
                this.__ngZone.schedulePromise(res, functionName);
            } else {
                // was called in the constructor, so reschuedle it
                nextTick(() => {
                    this.__ngZone.schedulePromise(res, functionName);
                });
            }
        }
        return res;
    };
}

function patchComponentClass(classType: any) {
    if (classType.__patched) return classType.ɵfac;
    const ori = classType.ɵfac;
    if (!ori) return;

    classType.__patched = true;
    classType.ɵfac = function (t: any) {
        const instance = ori(t);
        instance.__ngZone = inject(AsyncNgZone);
        return instance;
    };

    for (const name of Object.getOwnPropertyNames(classType.prototype)) {
        if (name === 'constructor') continue;
        patch(name, classType.prototype);
    }

    const cmp = classType.ɵcmp;
    if (cmp && cmp.directiveDefs) {
        for (const dep of cmp.directiveDefs()) {
            patchComponent(dep);
        }
    }

    return classType.ɵfac;
}

function patchComponent(type: { type: any, factory: any, directiveDefs: () => any[] }) {
    type.factory = type.type.ɵfac;
    if (type.type.__patched) return;

    type.factory = patchComponentClass(type.type);

    if (type && type.directiveDefs) {
        for (const dep of type.directiveDefs()) {
            patchComponent(dep);
        }
    }
}

@NgModule({})
export class ZoneModule {
    constructor(f: RendererFactory2, app: ApplicationRef, @Optional() router?: Router) {
        const ori2: any = f.constructor.prototype.createRenderer;
        f.constructor.prototype.createRenderer = function (...args: any[]) {
            const [element, type] = args;
            if (type) {
                patchComponent(type);
            }
            return ori2.apply(this, args);
        };

        if ('undefined' !== typeof document) {
            document.addEventListener('click', () => app.tick());
            document.addEventListener('focus', () => app.tick());
            document.addEventListener('blur', () => app.tick());
            document.addEventListener('keydown', () => app.tick());
            document.addEventListener('keyup', () => app.tick());
            document.addEventListener('keypress', () => app.tick());
            document.addEventListener('mousedown', () => app.tick());
        }

        //necessary to render all router-outlet once the router changes
        if (router) {
            router.events.subscribe((event) => {
                if (event instanceof NavigationEnd || event instanceof ActivationEnd) {
                    app.tick();
                }
            }, () => undefined);
        }
    }

    static forRoot(): ModuleWithProviders<ZoneModule> {
        return {
            ngModule: ZoneModule,
            providers: [
                AsyncNgZone,
                { provide: NgZone, useExisting: AsyncNgZone },
            ]
        };
    }
}

export const withZoneModule = () => importProvidersFrom(ZoneModule.forRoot());

let ids = 0;

NgZone.assertInAngularZone = () => undefined;
NgZone.assertNotInAngularZone = () => undefined;

@Injectable()
export class AsyncNgZone implements NgZone {
    hasPendingMicrotasks = false;
    hasPendingMacrotasks = false;
    isStable = false;
    readonly onUnstable = new EventEmitter<any>();

    // this triggers applicationRef.tick()
    readonly onMicrotaskEmpty = new EventEmitter<any>();
    readonly onStable = new EventEmitter<any>();
    readonly onError = new EventEmitter<any>();

    protected runs = 0;
    protected nextStable?: any;
    id = ids++;

    protected nextError?: any;

    constructor(private injector: Injector) {
    }

    static assertInAngularZone(): void {

    }

    static assertNotInAngularZone(): void {

    }

    schedulePromise(res: Promise<any>, label: string = '') {
        const id = this.newRun();
        res.then(() => {
            this.runFinished();
        }, (error) => {
            this.runs--;
            if (this.nextError) clearTick(this.nextError);
            this.nextError = nextTick(() => {
                this.onError.emit(error);
                this.trigger();
            });
        });
    }

    protected newRun() {
        if (this.nextStable) clearTick(this.nextStable);
        this.isStable = false;
        this.hasPendingMicrotasks = true;
        this.runs++;
        return this.runs;
    }

    protected runFinished() {
        this.runs--;
        this.trigger();
    }

    protected trigger() {
        this.onMicrotaskEmpty.emit();
        if (this.nextStable) clearTick(this.nextStable);

        if (this.runs === 0) {
            this.nextStable = nextTick(() => {
                this.nextStable = undefined;
                this.hasPendingMicrotasks = false;
                this.onMicrotaskEmpty.emit();

                if (!this.isStable) {
                    //this should only be called at the end when app bootstrapped and nothing else is happening
                    this.isStable = true;
                    console.log('stable!');
                    this.onStable.emit(true);
                }
            });
        }
    }

    run<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any): T {
        const r = fn.apply(applyThis, applyArgs);
        if (r instanceof Promise) {
            this.schedulePromise(r);
        } else {
            setTimeout(() => {
                if (!this.isStable && this.runs === 0) {
                    this.hasPendingMicrotasks = false;
                    this.isStable = true;
                    console.log('stable!');
                    this.onStable.emit(true);
                }
            });
            //do not trigger onMicrotaskEmpty here, because this will lead to an endless loop
        }
        return r;
    }

    runGuarded<T>(fn: (...args: any[]) => any, applyThis?: any, applyArgs?: any): any {
        try {
            return this.run(fn, applyThis, applyArgs);
        } catch (error) {
            this.onError.emit(error);
        }
    }

    runOutsideAngular<T>(fn: (...args: any[]) => T): T {
        return fn();
    }

    runTask<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any, name?: string): T {
        return fn.apply(applyThis, applyArgs);
    }
}
