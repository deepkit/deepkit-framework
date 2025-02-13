import { RpcClientEventIncomingMessage, RpcClientEventOutgoingMessage, RpcTypes } from '@deepkit/rpc';
import { Component, Input, OnChanges } from '@angular/core';
import { trackByIndex } from '@deepkit/ui-library';
import { inspect } from '../../utils';

@Component({
    selector: 'rpc-inspect-message',
    template: `
        <div class="header">
            <div class="id">
                {{message.id}}
            </div>
            <div class="type">
                {{RpcTypes[message.type] || message.type}}
            </div>
            <div style="flex: 1;">
                {{message.date|date:'MMM d, HH:mm:ss.SSS'}}
            </div>
            <div *ngIf="message.composite">
                [composite]
            </div>
        </div>
        <div class="body">
            <div class="composite" *ngIf="message.composite">
                <div class="message" *ngFor="let m of messages; trackBy: trackByIndex">
                    <div>{{RpcTypes[m.type] || m.type}}</div>
                    <div class="code overlay-scrollbar-small" codeHighlight [code]="m.body"></div>
                </div>
            </div>
            <ng-container *ngIf="!message.composite">
                <div class="code overlay-scrollbar-small" codeHighlight [code]="body"></div>
            </ng-container>
        </div>
    `,
    styleUrls: ['./rpc-inspect-message.component.scss'],
    standalone: false
})
export class RpcInspectMessageComponent implements OnChanges {
    RpcTypes = RpcTypes;
    trackByIndex = trackByIndex;
    @Input() message!: RpcClientEventIncomingMessage | RpcClientEventOutgoingMessage;

    messages: { type: number, body: string }[] = [];

    public body: string = '';

    ngOnChanges(): void {
        this.body = inspect(this.message.body);

        this.messages = [];
        for (const message of this.message.messages) {
            this.messages.push({
                type: message.type,
                body: inspect(message.body)
            });
        }
    }

}
