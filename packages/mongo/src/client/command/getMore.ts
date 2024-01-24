import { UUID } from '@deepkit/type';

export interface GetMoreMessage {
    getMore: bigint;
    $db: string;
    collection: string;
    batchSize?: number;
    maxTimeMS?: number;
    comment?: string;

    lsid?: { id: UUID };
    txnNumber?: number;
    startTransaction?: boolean;
    autocommit?: boolean;
}
