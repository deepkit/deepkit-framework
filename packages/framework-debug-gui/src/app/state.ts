import { EfficientState } from '@deepkit/desktop-ui';
import { EventToken } from '@deepkit/event';
import { Progress } from '@deepkit/rpc';
import { Excluded } from '@deepkit/type';

export const fileQueuedEvent = new EventToken('file.queued');
export const fileAddedEvent = new EventToken('file.added');
export const fileUploadedEvent = new EventToken('file.uploaded');

export interface FileToUpload {
    filesystem: number;
    name: string;
    dir: string;
    data: Uint8Array;
    progress?: Progress;
    done?: true;
    errored?: true;
}

export class VolatileState {
    filesToUpload: FileToUpload[] = [];
}

export class State extends EfficientState {

    volatile: VolatileState & Excluded = new VolatileState();

    media: { view: 'icons' | 'list' } = {
        view: 'icons'
    };
}
