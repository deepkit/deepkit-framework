/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {BehaviorSubject} from 'rxjs';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/;

export function jsonParser(key: string, value: any) {
    if (typeof value === 'string' && value[10] === 'T') {
        const a = dateRegex.exec(value);

        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
        }
    }

    return value;
}

export function extractParams(message: string, args: number = 1): string[] {
    const res: string[] = [];
    let currentPos = message.indexOf(':');
    for (let i = 0; i < args; i++) {
        const nextPos = message.substring(currentPos + 1).indexOf(':');
        if (nextPos !== -1) {
            res.push(message.substr(currentPos + 1, nextPos));
            currentPos = currentPos + 1 + nextPos;
        } else {
            res.push(message.substr(currentPos + 1));
            currentPos = message.length;
        }
    }
    if (currentPos !== message.length) {
        res.push(message.substring(currentPos + 1));
    }
    return res;
}

export class Progress extends BehaviorSubject<Progress> {
    public done = false;

    public total = 0;
    public current = 0;

    protected lastTime = 0;

    constructor() {
        super(undefined!);
        this.next(this);
    }

    public setStart(total: number) {
        this.total = total;
        this.lastTime = Date.now();
    }

    public setBatch(size: number) {
        this.current += size;
        this.lastTime = Date.now();
        this.next(this);
    }

    get progress(): number {
        if (this.done) return 1;
        if (this.total === 0) return 0;
        return this.current / this.total;
    }

    next(progress: this) {
        this.total = progress.total;
        this.current = progress.current;
        this.done = progress.done;

        super.next(this);
    }

    public setDone() {
        this.done = true;
        this.next(this);
    }
}

/**
 * Parses messages from websocket messages while handling batches and converting.
 */
export class Batcher {
    protected batches: { [id: string]: { json: string, messageId: number, totalLength: number } } = {};

    protected progress: { [messageId: string]: Progress[] } = {};

    constructor(protected callback: (message: object) => void) {
    }

    public registerProgress(messageId: number, progress: Progress[]) {
        if (!this.progress[messageId]) {
            this.progress[messageId] = [];
        }

        this.progress[messageId].push(...progress);
    }

    public handle(message: string) {
        if (message.startsWith('@batch-start:')) {
            //@batch-start:<messageIdOr0>:<chunkId>:<total-length>
            const [messageId, chunkId, totalLength] = extractParams(message, 2);
            if (this.batches[chunkId]) {
                throw new Error(`Chunk with id ${chunkId} already exists`);
            }
            const id = parseInt(messageId, 10);
            const total = parseInt(totalLength, 10);

            this.batches[chunkId] = {
                json: '',
                messageId: id,
                totalLength: total
            };

            if (this.progress[id]) {
                for (const p of this.progress[id]) {
                    p.setStart(total);
                }
            }
        } else if (message.startsWith('@batch:')) {
            //@batch-start:<chunkId>:json
            const [chunkId, leftMessage] = extractParams(message, 1);
            if (!this.batches[chunkId]) {
                throw new Error(`Chunk with id ${chunkId} does not exists`);
            }
            this.batches[chunkId].json += leftMessage;
            const id = this.batches[chunkId].messageId;

            if (this.progress[id]) {
                for (const p of this.progress[id]) {
                    p.setBatch(leftMessage.length);
                }
            }
        } else if (message.startsWith('@batch-end:')) {
            //@batch-end:<chunkId>
            const [chunkId] = extractParams(message, 1);
            if (!this.batches[chunkId]) {
                throw new Error(`Chunk with id ${chunkId} does not exists`);
            }

            this.messageComplete(this.batches[chunkId].json);
            const id = this.batches[chunkId].messageId;
            delete this.batches[chunkId];

            if (this.progress[id]) {
                for (const p of this.progress[id]) {
                    p.setDone();
                }
            }
        } else {
            this.messageComplete(message);
        }
    }


    protected messageComplete(message: string) {
        const decoded = JSON.parse(message, jsonParser);
        if (!decoded) {
            throw new Error(`Got invalid message: ` + message);
        }
        const id = decoded['id'] || 0;
        const type = decoded['type'] || '';
        const returnType = decoded['returnType'] || '';

        if ((type.startsWith('next/') || (type === 'type' && returnType === 'subject')) && this.progress[id]) {
            for (const p of this.progress[id]) {
                p.setDone();
            }
        }
        this.callback(decoded);
    }
}
