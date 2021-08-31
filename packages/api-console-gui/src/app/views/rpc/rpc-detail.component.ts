import { Component, Input } from '@angular/core';
import { ApiAction } from '../../../api';
import { Store } from '../../store';

@Component({
    selector: 'api-console-action-detail',
    template: `
        <div class="wrapper">
            <dui-button-group class="method" padding="none">
                <dui-select textured>
                    <dui-option>Client 1</dui-option>
                    <dui-option-separator></dui-option-separator>
                    <dui-option>Add Client</dui-option>
                </dui-select>
                <div class="name">
                    <div>
                        <span class="signature">{{action.controllerClassName}}.</span>{{action.methodName}}(<span class="signature">{{action.parameterSignature}}</span>): <span class="signature">{{action.returnSignature}}</span>
                    </div>
                </div>
                <dui-button icon="play" textured (click)="execute()"></dui-button>
            </dui-button-group>
        </div>
    `,
    styleUrls: ['./rpc-detail.component.scss']
})
export class RpcDetailComponent {
    @Input() action!: ApiAction;

    constructor(public store: Store) {
    }

    execute() {

    }
}
