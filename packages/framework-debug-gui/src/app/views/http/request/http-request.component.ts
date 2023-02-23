/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ControllerClient } from '../../../client';
import { EntitySubject } from '@deepkit/rpc';
import { DebugRequest, Workflow } from '@deepkit/framework-debug-api';

@Component({
    template: `
        <ng-container *ngIf="request|async as request">
            <div class="header">
                <h3>#{{request.id}}</h3>
                <div class="text-selection">{{request.method}} {{request.url}}</div>
                <div class="text-selection">Status {{request.statusCode}}</div>
                <div class="text-selection">{{request.created|date:'medium'}}</div>
                <div class="text-selection">Response time: {{time(request.times['http'])}}</div>
            </div>

            <div>
                <dui-button-group>
                    <dui-tab-button [active]="true">Overview</dui-tab-button>
                    <dui-tab-button>Events (5)</dui-tab-button>
                    <dui-tab-button>Queries (5)</dui-tab-button>
                    <dui-tab-button>Mails</dui-tab-button>
                    <dui-tab-button>Message Bus</dui-tab-button>
                    <dui-tab-button>Logs</dui-tab-button>
                </dui-button-group>
            </div>

            <div class="workflow" style="height: 250px; margin-bottom: 10px; overflow: auto" class="overlay-scrollbar-small" *ngIf="httpWorkflow">
                <app-workflow [workflow]="httpWorkflow">
                    <ng-container *ngFor="let placeName of httpWorkflow.places">
                        <app-workflow-card [name]="placeName" class="valid" *ngIf="request.times['workflow/http/' + placeName]">
                            <div style="color: var(--text-light)">{{time(request.times['workflow/http/' + placeName])}}</div>
                        </app-workflow-card>

                        <app-workflow-card [name]="placeName" class="invalid" *ngIf="undefined === request.times['workflow/http/' + placeName]">
                        </app-workflow-card>
                    </ng-container>
                </app-workflow>
            </div>

            //total db time: split in query time & serialization time
            //total message bus time
            //workflow times
            //event times
            //session user & storage
            //resolved route
            //request body & header
            //response body & header
            //triggered events
            //created services in DI
            //template render times for each render(), so we see bottlenecks easily
            //logs by levels
            //database queries: query time, serialization time
            //message bus events

            <div class="logs">
                Logs
            </div>
        </ng-container>
    `,
    styles: [`
        :host::ng-deep .node.invalid {
            color: var(--text-light);
        }

        :host::ng-deep .node.valid {
            border: 0;
        }

        :host::ng-deep .node.valid::after {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            border: 1px solid var(--color-green);
            opacity: 0.3;
        }

    `]
})
export class HttpRequestComponent {
    public request?: EntitySubject<DebugRequest>;
    public httpWorkflow?: Workflow;

    constructor(
        protected activatedRoute: ActivatedRoute,
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
    ) {
        activatedRoute.params.subscribe((p) => {
            setTimeout(() => this.loadRequest(Number(p.id)));
        });
    }

    public time(took?: number): string {
        if (took === undefined) return '-';
        if (took >= 1000) return (took / 1000).toFixed(3) + 's';
        return (took).toFixed(3) + 'ms';
    }

    protected async loadRequest(id: number) {
        // const requests = await this.controllerClient.getHttpRequests();
        // this.request = requests.getEntitySubject(id);

        this.httpWorkflow = await this.controllerClient.getWorkflow('http');

        this.cd.detectChanges();
    }
}
