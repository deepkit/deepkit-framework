import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    template: ` <app-media *ngIf="filesystemId !== undefined" [filesystem]="filesystemId"></app-media> `,
})
export class FilesystemComponent {
    filesystemId?: number;

    constructor(private activatedRoute: ActivatedRoute) {
        activatedRoute.params.subscribe(params => {
            this.filesystemId = Number(params.id);
            this.load();
        });
    }

    async load() {
        if (undefined === this.filesystemId) return;
    }
}
