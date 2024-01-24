import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { ModuleApi } from '@deepkit/framework-debug-api';
import { LiveSubject } from '@deepkit/ui-library';

import { ControllerClient } from '../../client';

@Component({
    template: `
        <div class="modules overlay-scrollbar">
            <module-detail *ngIf="apiModule | asyncRender as m" [m]="m"></module-detail>
        </div>
        <div class="bottom-bar">
            <span class="">— encapsulated</span>
            <span class="imported">— imported</span>
            <span class="exported">— exported</span>
            <span class="for-root">— for root</span>
        </div>
    `,
    styleUrls: ['./modules.component.scss'],
})
export class ModulesComponent implements OnDestroy {
    public apiModule = new LiveSubject<ModuleApi>(subject => {
        this.client.debug.modules().then(v => subject.next(v));
    });

    protected reconnectedSub: Subscription;

    constructor(public client: ControllerClient) {
        this.reconnectedSub = client.client.transporter.reconnected.subscribe(() => {
            this.apiModule.reload();
        });
    }

    ngOnDestroy(): void {
        this.reconnectedSub.unsubscribe();
    }
}
