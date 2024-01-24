import { ChangeDetectorRef, Component } from '@angular/core';

import { EventDispatcher } from '@deepkit/event';
import { ClientProgress } from '@deepkit/rpc';

import { ControllerClient } from '../client';
import { FileToUpload, State, fileQueuedEvent, fileUploadedEvent } from '../state';

@Component({
    selector: 'app-file-uploader',
    styles: [
        `
            :host {
                display: block;
                margin-right: 10px;
            }
        `,
    ],
    template: `
        <ng-container *ngIf="filesToUpload.length">
            Upload {{ currentIndex }} of {{ state.volatile.filesToUpload.length }}:
            <dui-indicator
                *ngIf="upload && upload.progress && upload.progress.upload | asyncRender as upload"
                [step]="upload.progress"
            ></dui-indicator>
            <dui-button small (click)="cancel()">Cancel</dui-button>
        </ng-container>
    `,
})
export class FileUploaderComponent {
    upload?: FileToUpload;

    constructor(
        private events: EventDispatcher,
        private cd: ChangeDetectorRef,
        public state: State,
        private client: ControllerClient,
    ) {
        events.listen(fileQueuedEvent, () => {
            this.checkNext();
        });
    }

    get filesToUpload(): FileToUpload[] {
        return this.state.volatile.filesToUpload.filter(v => !v.done && !v.errored);
    }

    get currentIndex(): number {
        if (!this.upload) return 0;
        return this.state.volatile.filesToUpload.indexOf(this.upload) + 1;
    }

    cancel() {}

    checkNext() {
        if (this.upload && !this.upload.done) return;

        const files = this.filesToUpload;
        if (!files.length) return;
        const file = files[0];
        console.log('next', file);
        if (!file) return;

        this.upload = file;
        file.progress = ClientProgress.track();
        this.cd.detectChanges();
        this.client.media.addFile(file.filesystem, file.name, file.dir, file.data).then(
            () => {
                file.done = true;
                this.cd.detectChanges();
                this.checkNext();
                this.events.dispatch(fileUploadedEvent);
            },
            error => {
                file.errored = true;
                this.checkNext();
                console.log('error', error);
                this.cd.detectChanges();
                this.events.dispatch(fileUploadedEvent);
            },
        );
    }
}
