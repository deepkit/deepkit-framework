/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Injectable } from '@angular/core';
import { DeepkitClient } from '@deepkit/rpc';
import { ApiConsoleApi, ApiDocument, ApiRoute } from '../api';
import { Subject, Subscriber, Subscription, SubscriptionLike } from 'rxjs';
import { first } from 'rxjs/operators';

/**
 * Emits values like BehaviorSubject, but with initially empty value.
 *
 * Executes the given `loader` when the first subscriber subscribes.
 * The loader then loads async data and passes the data via `next` to this
 * subject and with that to all its subscribers.
 */
export class LiveSubject<T> extends Subject<T> {
    value?: T;
    protected loaderCalled: boolean = false;

    constructor(protected loader: (subject: LiveSubject<T>) => void) {
        super();
    }

    hasValue(): boolean {
        return this.value !== undefined;
    }

    get valueArrival(): Promise<T> {
        if (this.value) return Promise.resolve(this.value);
        return this.pipe(first()).toPromise();
    }

    /**
     * Reloads data from the loader.
     */
    reload(): void {
        this.loaderCalled = true;
        this.loader(this);
    }

    _subscribe(subscriber: Subscriber<T>): Subscription {
        const subscription = super._subscribe(subscriber);
        if (this.hasValue() && subscription && !(<SubscriptionLike>subscription).closed) {
            subscriber.next(this.value);
        }
        if (!this.loaderCalled && !this.hasValue()) {
            this.loaderCalled = true;
            this.loader(this);
        }
        return subscription;
    }

    next(v: T) {
        super.next(this.value = v);
    }
}

@Injectable()
export class ControllerClient {
    public routes = new LiveSubject<ApiRoute[]>((subject) => {
        this.api.getRoutes().then(v => subject.next(v));
    });

    public document = new LiveSubject<ApiDocument>((subject) => {
        this.api.getDocument().then(v => subject.next(v));
    });

    constructor(public client: DeepkitClient) {
        client.transporter.reconnected.subscribe(() => {
            this.routes.reload();
            this.document.reload();
        });
        client.transporter.disconnected.subscribe(() => {
            this.tryToConnect();
        });
    }

    tryToConnect() {
        this.client.connect().catch(() => {
            setTimeout(() => {
                this.tryToConnect();
            }, 1_000);
        });
    }

    setController(name: string) {
        console.log('setController', name);
        this.api = this.client.controller<ApiConsoleApi>(name);
    }

    public api = this.client.controller(ApiConsoleApi);

    static getServerHost(): string {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + (location.port === '4200' ? location.hostname + ':8080' : location.host);
    }
}
