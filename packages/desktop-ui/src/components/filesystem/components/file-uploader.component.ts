import { Component, computed } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FilesystemState, truncateFileName } from '../api';
import { ButtonComponent } from '../../button/button.component';
import { IndicatorComponent } from '../../indicator/indicator.component';

@Component({
    selector: 'dui-filesystem-uploader',
    standalone: true,
    template: `
      @if (filesToUpload().length; as total) {
        @if (state.upload(); as upload) {
          Upload {{ currentIndex() }} of {{ total }}: {{ truncateFileName(upload.name) }}
          @if (upload && upload.progress && upload.progress.upload|async; as progress) {
            <dui-indicator [step]="progress.progress"/>
          }
          <dui-button small (click)="cancel()">Cancel</dui-button>
        }
      } @else if (state.uploadQueue().length) {
        <span>Uploaded ({{state.uploadQueue().length}}) successfully</span>
      }
    `,
    styles: [`
      :host {
        display: flex;
        flex-direction: row;
        gap: 8px;
        align-items: center;
      }
      
      span {
        color: var(--dui-text-grey);
      }
    `],
    imports: [
        AsyncPipe,
        ButtonComponent,
        IndicatorComponent,
    ],
})
export class FileUploaderComponent {
    truncateFileName = truncateFileName;
    filesToUpload = computed(() => this.state.uploadQueue().filter(v => !v.done && !v.errored && !v.aborted));

    currentIndex = computed(() => {
        const upload = this.state.upload();
        if (!upload) return 0;
        return this.state.uploadQueue().indexOf(upload) + 1;
    });

    constructor(public state: FilesystemState) {
    }

    cancel() {

    }
}

