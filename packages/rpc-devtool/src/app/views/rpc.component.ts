import { Component, computed, effect, OnInit, Signal, signal } from '@angular/core';
import { Client, clients } from '../collector';
import { DuiButtonModule, DuiInputModule, DuiSelectModule, DuiTableModule, DuiTabsModule } from '@deepkit/desktop-ui';
import { DatePipe, DecimalPipe, JsonPipe, KeyValuePipe, SlicePipe } from '@angular/common';
import { humanBytes } from '@deepkit/core';
import { FormsModule } from '@angular/forms';
import { RpcTypes } from '@deepkit/rpc';

@Component({
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }

        .client {
            display: flex;
            flex-direction: row;
            height: 100%;
            flex: 1;

            .stats {
                width: 300px;
                padding: 10px;
            }
        }

        .stats {
            .block {
                margin: 5px 0;
            }
        }

        .summary-actions {
            table-layout: fixed;
            width: 100%;

            .action {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .value {
                width: 40px;
                text-align: right;
                padding-left: 10px;
                padding-right: 5px;
            }
        }

        .data {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }
    `,
    template: `
        <dui-tabs>
        </dui-tabs>

        <div class="client">
            <div class="stats">
                <dui-select textured [(ngModel)]="selected" style="width: 100%">
                    @for (client of clients(); track client().id) {
                        <dui-option [value]="client">
                            {{ client().closed ? '🔴' : '🟢' }}
                            {{ client().url|slice:0:50 }} #{{ client().id }}
                        </dui-option>
                    }
                </dui-select>

                @if (selected(); as client) {
                    <div class="block">
                        <div>Created: {{ client().createdAt|date:'medium' }}
                            ({{ client().closed ? 'closed' : 'open' }})
                        </div>
                        @if (client().closed) {
                            <div>Closed: {{ client().closedAt|date:'medium' }}</div>
                        }
                    </div>

                    @if (client().summary(); as summary) {
                        <div class="block">
                            <div>Messages received: {{ summary.received }} ( {{ humanBytes(summary.receivedBytes) }})
                            </div>
                            <div>Messages sent: {{ summary.sent }} ( {{ humanBytes(summary.sentBytes) }} )</div>
                            <div>Actions executed: {{ summary.actionsTotal }}</div>
                        </div>

                        <table class="summary-actions">
                            @for (action of summary.actions | keyvalue; track action.key) {
                                <tr>
                                    <td class="action">{{ action.key }}</td>
                                    <td class="value">{{ action.value }}</td>
                                </tr>
                            }
                        </table>
                    }
                }
            </div>
            <div class="data">
                <div class="filter">
                    <dui-button-group>
                        <dui-tab-button (click)="tableView.set('actions')" [active]="tableView() === 'actions'">
                            Actions
                        </dui-tab-button>
                        <dui-tab-button (click)="tableView.set('messages')" [active]="tableView() === 'messages'">
                            Messages
                        </dui-tab-button>
                    </dui-button-group>
                    <dui-input textured lightFocus [(ngModel)]="filterText" placeholder="Filter action ..."></dui-input>
                </div>

                @if (tableView() === 'messages') {
                    <dui-table preferenceKey="rpc/message" [items]="messages()" style="height: 100%;" noFocusOutline
                               defaultSort="id">
                        <dui-table-column name="idx" [width]="50"></dui-table-column>
                        <dui-table-column name="id" [width]="50"></dui-table-column>
                        <dui-table-column name="direction"></dui-table-column>
                        <dui-table-column name="type" [width]="160">
                            <ng-container *duiTableCell="let message">
                                {{ RpcTypes[message.deepkit?.debug.type] }}
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="timestamp" [width]="120"></dui-table-column>
                        <dui-table-column name="size">
                            <ng-container *duiTableCell="let message">
                                {{ humanBytes(message.size) }}
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="data" [width]="500">
                            <ng-container *duiTableCell="let message">
                                {{ message.deepkit?.debug.body | json | slice:0:500 }}
                            </ng-container>
                        </dui-table-column>
                    </dui-table>
                } @else {
                    <dui-table preferenceKey="rpc/actions" [items]="actions()" style="height: 100%;" noFocusOutline
                               defaultSort="id">
                        <dui-table-column name="idx" [width]="50"></dui-table-column>
                        <dui-table-column name="id" [width]="50"></dui-table-column>
                        <dui-table-column name="action" [width]="300"></dui-table-column>
                        <dui-table-column name="timestamp" [width]="120"></dui-table-column>
                        <dui-table-column name="status" [width]="150"></dui-table-column>
                        <dui-table-column name="time" [width]="150">
                            <ng-container *duiTableCell="let message">
                                @if (message.took) {
                                  {{ message.took|number:'0.0-3' }} ms
                                } @else {
                                    -
                                }
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="size" [width]="120">
                            <ng-container *duiTableCell="let message">
                                {{ humanBytes(message.size) }}
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="returnType">
                            <ng-container *duiTableCell="let message">
                                {{ message.returnType }}
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="responses" header="emits" [width]="55"></dui-table-column>
                        <dui-table-column name="errors" [width]="55"></dui-table-column>
                        <dui-table-column name="subscriptions" header="subs" [width]="55"></dui-table-column>
                        <dui-table-column name="args">
                            <ng-container *duiTableCell="let message">
                                {{ message.args | json }}
                            </ng-container>
                        </dui-table-column>
                        <dui-table-column name="response" header="return/emitted" [width]="500">
                            <ng-container *duiTableCell="let message">
                                {{ message.response | json | slice:0:500 }}
                            </ng-container>
                        </dui-table-column>
                    </dui-table>
                }

            </div>
        </div>
    `,
    imports: [
        DuiTableModule,
        DuiTabsModule,
        SlicePipe,
        JsonPipe,
        KeyValuePipe,
        DuiInputModule,
        FormsModule,
        DuiButtonModule,
        DuiSelectModule,
        DatePipe,
        DecimalPipe,
    ],
})
export class RpcViewComponent implements OnInit {
    clients = clients;

    tableView = signal('actions');

    selected = signal<Signal<Client> | undefined>(undefined);

    filterText = signal('');

    actions = computed(() => {
        const selected = this.selected()?.();
        if (!selected) return [];
        const filter = this.filterText().toLowerCase();
        if (!filter) return selected.actions();

        return selected.actions().filter(v => v.action.toLowerCase().includes(filter));
    });

    messages = computed(() => {
        const selected = this.selected()?.();
        if (!selected) return [];
        return selected.messages();
    });

    constructor() {
        effect(() => {
            const selected = this.selected();
            const _clients = clients();
            if (_clients.length === 0) {
                this.selected.set(undefined);
                return;
            }
            if (selected) return;
            const first = _clients[0];
            if (first) this.selected.set(first);
        });
    }

    ngOnInit() {
    }

    protected readonly humanBytes = humanBytes;
    protected readonly RpcTypes = RpcTypes;
}
