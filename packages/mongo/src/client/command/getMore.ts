import { ReadPreferenceMessage, TransactionalMessage } from './command.js';

export type GetMoreMessage = {
    getMore: bigint;
    $db: string;
    collection: string;
    batchSize?: number;
    maxTimeMS?: number;
    comment?: string;
} & TransactionalMessage & ReadPreferenceMessage;
