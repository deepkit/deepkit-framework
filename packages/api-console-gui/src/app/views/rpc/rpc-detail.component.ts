import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { propertyToTSInterface, trackByIndex } from '@deepkit/ui-library';
import { ApiAction } from '../../../api';
import { extractDataStructureFromSchema, RpcActionState, RpcClientConfiguration, RpcExecution, RpcExecutionSubscription, Store } from '../../store';
import { DuiDialog } from '@deepkit/desktop-ui';
import { DisconnectableObservable, RpcWebSocketClient } from '@deepkit/rpc';
import { ControllerClient } from '../../client';
import { Observable, Subject } from 'rxjs';
import { inspect } from '../../utils';
import { isSubject } from '@deepkit/core-rxjs';

@Component({
    selector: 'api-console-action-detail',
    template: `
        <div class="main">
            <div class="form" *ngIf="actionState">
                <div class="method-container">
                    <dui-button-group class="method" padding="none">
                        <div class="name">
                            <div class="text-selection">
                                <span class="signature">{{action.controllerClassName}}.</span>{{action.methodName}}(<span class="signature">{{action.parameterSignature}}</span>):
                                <span
                                    class="signature">{{action.returnSignature}}</span>
                            </div>
                        </div>
                        <dui-select textured [(ngModel)]="store.state.rpcClient">
                            <dui-option [value]="client" *ngFor="let client of store.state.rpcClients; trackBy: trackByIndex">{{client.name}}</dui-option>
                        </dui-select>
                        <dui-button icon="play" textured (click)="execute()"></dui-button>
                    </dui-button-group>
                </div>

                <div class="container overlay-scrollbar-small">
                    <ng-container *ngIf="action.getParametersType() as schema">
                        <deepkit-box title="Parameter">
                            <ng-container *ngFor="let p of schema.getProperties(); trackBy: trackByIndex">
                                <api-console-input [decoration]="true" (keyDown)="consoleInputKeyDown($event)"
                                                   [model]="actionState.params.getProperty(p.name)"
                                                   [property]="p"
                                                   (modelChange)="updateState()"></api-console-input>
                            </ng-container>
                        </deepkit-box>
                    </ng-container>

                    <deepkit-box title="Return type" style="padding: 12px" *ngIf="action.getResultsType() as schema">
                        <div class="ts text-selection">
                            <div class="ts text-selection" *ngIf="schema.getProperty('v') as property">
                                <div codeHighlight [code]="propertyToTSInterface(property)"></div>
                            </div>
                        </div>
                    </deepkit-box>
                </div>
            </div>

            <div class="executions">
                <dui-button-group style="margin: 6px 10px; margin-top: 12px;">
                    <dui-tab-button (click)="switchViewRequest('selected')" [active]="store.state.viewRpc.viewRequests === 'selected'">Selected</dui-tab-button>
                    <dui-tab-button (click)="switchViewRequest('all')" [active]="store.state.viewRpc.viewRequests === 'all'">All</dui-tab-button>
                </dui-button-group>

                <div class="list overlay-scrollbar-small">
                    <div class="execution" *ngFor="let e of list; trackBy: trackByIndex; let i = index">
                        <div class="title-line">
                            <dui-icon clickable (click)="e.open = !isOpen(e, i)" [name]="isOpen(e, i) ? 'arrow_down' : 'arrow_right'"></dui-icon>
                            <div class="method">{{e.controllerClassName}}.{{e.method}}</div>
                            <div class="status">
                                <div class="status-box"
                                     [class.red]="e.error"
                                     [class.orange]="e.isObservable()"
                                >
                                    {{getTitleStatus(e)}}
                                </div>
                            </div>
                            <dui-icon clickable (click)="remove(i)" name="garbage"></dui-icon>
                        </div>
                        <div class="result" *ngIf="isOpen(e, i)">
                            <div class="info">
                                Executed at {{e.created|date:'short'}} in {{e.took|number:'0.0-3'}} ms using {{e.clientName}}.
                            </div>

                            <div class="content">
                                <div class="ts text-selection" *ngIf="e.error">
                                    <div codeHighlight [code]="e.error"></div>
                                </div>
                                <div class="ts text-selection" *ngIf="e.isObservable()">
                                    <div *ngIf="e.observable">
                                        <dui-button (click)="subscribe(e, e.observable)">Subscribe</dui-button>
                                        <dui-button (click)="disconnectObservable(e)">Disconnect observable</dui-button>
                                    </div>
                                    <div class="subscription" *ngFor="let sub of e.subscriptions; trackBy: trackById">
                                        <div class="header">
                                            #{{sub.id}}
                                            <span *ngIf="!sub.completed && !sub.error && !sub.unsubscribed">
                                                <dui-button (click)="unsubscribe(sub)" small>Unsubscribe</dui-button>
                                            </span>
                                            <span *ngIf="sub.completed">Completed</span>
                                            <span *ngIf="sub.unsubscribed">Unsubscribed</span>
                                        </div>
                                        <div class="error" *ngIf="sub.error">{{sub.error}}</div>
                                        <div class="emitted" *ngFor="let emitted of sub.emitted; trackBy: trackByIndex; let i = index">
                                            <div class="ts text-selection">
                                                #{{sub.emitted.length - i}}
                                                <div codeHighlight [code]="emitted"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="ts text-selection" *ngIf="e.type === 'static'">
                                    <div codeHighlight [code]="e.result"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <deepkit-toggle-box class="clients" title="Clients"
                            [(visible)]="store.state.viewRpc.displayClients" (visibleChange)="store.store()"
                            [(height)]="store.state.viewRpc.displayClientsHeight" (heightChange)="store.store()"
        >
            <ng-container header>
            </ng-container>
            <div style="margin: 6px 10px; margin-top: 12px; display: flex; align-items: center">
                <dui-button-group padding="none">
                    <dui-button small icon="add" title="New client" (click)="addRpcClient()"></dui-button>
                    <dui-select small textured [(ngModel)]="store.state.activeDebugRpcClientIndex">
                        <dui-option
                            [value]="i"
                            *ngFor="let client of store.state.rpcClients; let i = index; trackBy: trackByIndex"
                        >
                            {{client.name}}
                        </dui-option>
                    </dui-select>
                    <dui-button small icon="clear" title="Clear history" (click)="deleteClientHistory()"></dui-button>
                    <dui-button small icon="garbage" title="Delete client" [disabled]="store.state.rpcClients.length === 1" (click)="deleteClient()"></dui-button>
                </dui-button-group>

                <dui-button-group>
                    <dui-tab-button (click)="clientDebugView = 'incoming'" [active]="clientDebugView === 'incoming'">Incoming</dui-tab-button>
                    <dui-tab-button (click)="clientDebugView = 'outgoing'" [active]="clientDebugView === 'outgoing'">Outgoing</dui-tab-button>

                    <ng-container *ngIf="store.state.rpcClients[store.state.activeDebugRpcClientIndex] as client">
                        <div class="connection-status">[
                            <ng-container *ngIf="client.client && client.client.transporter.connection|asyncRender as connected; else disconnected">
                                Connected
                            </ng-container>
                            <ng-template #disconnected>
                                Disconnected
                            </ng-template>
                            ]
                        </div>
                    </ng-container>
                </dui-button-group>
            </div>

            <div class="container">
                <ng-container *ngIf="store.state.rpcClients[store.state.activeDebugRpcClientIndex] as client">
                    <ng-container *ngIf="clientDebugView === 'incoming'">
                        <ng-container *ngFor="let m of client.incomingMessages">
                            <rpc-inspect-message [message]="m"></rpc-inspect-message>
                        </ng-container>
                    </ng-container>

                    <ng-container *ngIf="clientDebugView === 'outgoing'">
                        <ng-container *ngFor="let m of client.outgoingMessages">
                            <rpc-inspect-message [message]="m"></rpc-inspect-message>
                        </ng-container>
                    </ng-container>
                </ng-container>
            </div>
        </deepkit-toggle-box>
    `,
    styleUrls: ['./rpc-detail.component.scss']
})
export class RpcDetailComponent implements OnChanges {
    trackByIndex = trackByIndex;
    propertyToTSInterface = propertyToTSInterface;
    @Input() action!: ApiAction;
    actionState?: RpcActionState;

    list: RpcExecution[] = [];

    clientDebugView: 'incoming' | 'outgoing' = 'incoming';

    args: any[] = [];

    constructor(public store: Store, private dialog: DuiDialog, private cd: ChangeDetectorRef) {
    }

    trackById(index: number, item: { id: any }) {
        return item.id;
    }

    getTitleStatus(e: RpcExecution): string {
        if (e.took === -1) return 'PENDING';
        if (e.isObservable()) {
            const atLeastOneActive = e.subscriptions.some(v => !v.error && !v.completed && !v.unsubscribed);

            if (e.observable) {
                if (atLeastOneActive) return 'OBSERVE';
                return 'WAITING';
            }

            if (atLeastOneActive) return 'OBSERVE';
            return 'CLOSED';
        }

        return e.error ? 'ERROR' : 'SUCCESS';
    }

    toggleClientsVisibility() {
        this.store.set(state => {
            state.viewRpc.displayClients = !state.viewRpc.displayClients;
        });
    }

    ngOnChanges(): void {
        this.actionState = this.store.state.getRpcActionState(this.action);
        this.updateList();
    }

    updateState() {
        this.store.store();
    }

    consoleInputKeyDown(event: KeyboardEvent) {
        if (event.key.toLowerCase() === 'enter') {
            this.execute();
        }
    }

    isOpen(e: RpcExecution, i: number): boolean {
        return e.open === undefined ? i === 0 : e.open;
    }

    remove(index: number): void {
        this.store.set(state => {
            const removed = state.rpcExecutions.splice(index, 1);
            for (const r of removed) {
                localStorage.removeItem('@deepkit/api-console/rpcExecution/result/' + r.bodyStoreId);
            }
        });

        this.updateList();
    }

    updateList() {
        if (this.store.state.viewRpc.viewRequests === 'all') {
            this.list = this.store.state.rpcExecutions;
        } else {
            if (this.action) {
                this.list = this.store.state.rpcExecutions.filter(r => {
                    return this.action.id === r.actionId();
                });
            } else {
                if (this.list.length > 0) this.list = [];
            }
        }
        this.cd.detectChanges();
    }

    switchViewRequest(view: 'all' | 'selected'): void {
        this.store.set(state => {
            state.viewRpc.viewRequests = view;
        });

        this.updateList();
    }

    disconnectObservable(execution: RpcExecution) {
        if (!execution.observable) return;
        (execution.observable as DisconnectableObservable<any>).disconnect();
        execution.observable = undefined;
        this.cd.detectChanges();
    }

    unsubscribe(sub: RpcExecutionSubscription) {
        sub.unsubscribed = true;
        sub.unsubscribe();
        this.cd.detectChanges();
    }

    subscribe(execution: RpcExecution, observable: Observable<any>) {
        const sub: RpcExecutionSubscription = {
            id: execution.subscriptionsId++,
            emitted: [],
            unsubscribed: false,
            completed: false,
            error: undefined,
            unsubscribe: function () {
                if (isSubject(observable)) {
                    observable.unsubscribe();
                } else {
                    sub.sub.unsubscribe();
                }
            },
            sub: observable.subscribe((v: any) => {
                const formatted = inspect(v);
                (sub.emitted as any) = [formatted, ...sub.emitted];
                this.cd.detectChanges();
            }, (error: any) => {
                sub.error = error;
                this.cd.detectChanges();
            }, () => {
                sub.completed = true;
                this.cd.detectChanges();
            })
        };
        execution.subscriptions.unshift(sub);
    }

    deleteClientHistory() {
        const client = this.store.state.rpcClient;
        if (!client) return;
        client.outgoingMessages.length = 0;
        client.incomingMessages.length = 0;
    }

    async deleteClient() {
        if (this.store.state.rpcClients.length === 1) return;

        const a = await this.dialog.confirm('Delete client?');
        if (!a) return;

        this.store.state.rpcClients.splice(this.store.state.activeRpcClientIndex, 1);
        this.store.state.activeRpcClientIndex = 0;
        this.store.state.activeDebugRpcClientIndex = 0;
    }

    async addRpcClient() {
        const name = 'Client ' + (this.store.state.rpcClients.length + 1);
        const a = await this.dialog.prompt('New RPC Client', name, 'Please choose a name');
        if (!a) return;
        const client = new RpcClientConfiguration(a);
        this.store.state.rpcClients.push(client);
        this.store.state.rpcClient = client;
        this.store.state.activeDebugRpcClientIndex = this.store.state.activeRpcClientIndex;
        this.store.store();
    }

    async execute() {
        if (!this.actionState) return;

        const args: any[] = [];
        const paramSchema = this.action.getParametersType();
        if (paramSchema) {
            const parameter: any = {};
            Object.assign(parameter, extractDataStructureFromSchema(this.actionState.params, paramSchema));
            args.push(...Object.values(parameter));
        }

        const execution = new RpcExecution(this.action.controllerClassName, this.action.controllerPath, this.action.methodName, args.slice(0));

        const client = this.store.state.rpcClient;
        if (!client) return;

        if (!client.client) {
            client.client = new RpcWebSocketClient(ControllerClient.getServerHost());
            client.client.disableTypeReuse();
            client.client.events.subscribe(v => {
                if (v.event === 'incoming') {
                    client.incomingMessages.unshift(v);
                    if (client.incomingMessages.length > 100) {
                        client.incomingMessages.splice(50);
                    }
                } else if (v.event === 'outgoing') {
                    client.outgoingMessages.unshift(v);
                    if (client.outgoingMessages.length > 100) {
                        client.outgoingMessages.splice(50);
                    }
                }
            });
        }

        if (!client.controller[execution.controllerPath]) {
            client.controller[execution.controllerPath] = client.client.controller(execution.controllerPath);
        }

        this.store.set(state => {
            state.rpcExecutions.unshift(execution);
            if (state.rpcExecutions.length > 100) {
                state.rpcExecutions.splice(100);
            }
        });
        this.updateList();

        const start = Date.now();
        try {
            const result: any = await (client.controller[execution.controllerPath] as any)[execution.method](...args);
            execution.took = Date.now() - start;
            if (result instanceof Subject) {
                execution.subject = result;
                execution.type = 'subject';
                this.subscribe(execution, result);
            } else if (result instanceof Observable) {
                execution.observable = result;
                execution.type = 'observable';
            } else {
                execution.result = inspect(result);
            }
        } catch (error) {
            execution.error = inspect(error);
        } finally {
            if (!execution.took) execution.took = Date.now() - start;
            this.cd.detectChanges();
            this.store.store();
        }
    }
}
