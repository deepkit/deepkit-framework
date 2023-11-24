import { getBSONDeserializer, getBSONSerializer } from '@deepkit/bson';
import { BrokerState, Queue} from './kernel.js';
import { QueueMessage, QueueMessageProcessing, SnapshotEntry, SnapshotEntryType} from './model.js';
import { handleMessageDeduplication } from './utils.js';

export function snapshotState(state: BrokerState, writer: (v: Uint8Array) => void) {
    const serializeEntry = getBSONSerializer<SnapshotEntry>();
    const serializeMessage = getBSONSerializer<QueueMessage>();

    for (const queue of state.queues.values()) {
        const q: SnapshotEntry = {
            currentId: queue.currentId,
            type: SnapshotEntryType.queue,
            name: queue.name,
            amount: queue.messages.length,
        };

        const bson = serializeEntry(q);
        writer(bson);

        for (const message of queue.messages.values()) {
            writer(serializeMessage(message));
        }
    }
}

function ensureDocumentIsInBuffer(buffer: Buffer, reader: (size: number) => Uint8Array): [Buffer, number] {
    let documentSize: number = buffer.byteLength >= 4 ? buffer.readUInt32LE(0) : 0;
    while (documentSize === 0 || buffer.byteLength < documentSize) {
        buffer = Buffer.concat([buffer, reader(documentSize ? documentSize - buffer.byteLength : 32)]);
        if (buffer.byteLength === 0) return [buffer, 0];
        if (documentSize === 0 && buffer.byteLength >= 4) {
            documentSize = buffer.readUInt32LE(0);
        }
    }
    return [buffer, documentSize];
}

export function restoreState(state: BrokerState, reader: (size: number) => Uint8Array) {
    const deserializeEntry = getBSONDeserializer<SnapshotEntry>();
    const deserializeMessage = getBSONDeserializer<QueueMessage>();

    while (true) {
        let [buffer, documentSize] = ensureDocumentIsInBuffer(Buffer.alloc(0), reader);
        if (!documentSize) return;
        const entry = deserializeEntry(buffer.subarray(0, documentSize));
        buffer = buffer.subarray(documentSize);

        const queue: Queue = {
            currentId: entry.currentId,
            name: entry.name,
            deduplicateMessageHashes: new Set(),
            messages: [],
            consumers: [],
        };

        state.queues.set(queue.name, queue);

        for (let i = 0; i < entry.amount; i++) {
            [buffer, documentSize] = ensureDocumentIsInBuffer(buffer, reader);
            if (documentSize === 0) return;
            const message = deserializeMessage(buffer);
            buffer = buffer.subarray(documentSize);
            queue.messages.push(message);
            if (message.process === QueueMessageProcessing.exactlyOnce) {
                const ttl = message.ttl - Date.now();
                handleMessageDeduplication(queue, message.v, ttl);
            }
        }
    }

}
