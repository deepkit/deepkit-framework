import { Component, Input } from '@angular/core';
import { Environment, Store } from '../store.js';
import { arrayRemoveItem, copy } from '@deepkit/core';
import { DialogComponent } from '@deepkit/desktop-ui';

@Component({
    template: `
        <h2>Environment</h2>

        <div style="margin-top: 10px;">
            <dui-form-row label="Name:">
                <dui-input required [(ngModel)]="environment.name"></dui-input>
            </dui-form-row>

            <div>
                <h3 style="margin-bottom: 5px;">Headers</h3>
                <api-console-headers [(model)]="environment.headers"></api-console-headers>
            </div>
        </div>

        <dui-dialog-actions>
            <dui-button style="margin-right: auto;" [disabled]="store.state.environments.length === 1" (click)="remove()">Delete</dui-button>
            <dui-button closeDialog>OK</dui-button>
        </dui-dialog-actions>
    `
})
export class EnvironmentDialogComponent {
    static dialogDefaults = {
        width: '500px'
    };

    @Input() environment!: Environment;

    constructor(public store: Store, protected dialogComponent: DialogComponent) {
    }

    remove() {
        if (!this.store.state.environments.length) return;
        arrayRemoveItem(this.store.state.environments, this.environment);
        this.store.state.environments = copy(this.store.state.environments);
        this.store.state.activeEnvironment = this.store.state.environments[0];
        this.dialogComponent.close();
    }
}
