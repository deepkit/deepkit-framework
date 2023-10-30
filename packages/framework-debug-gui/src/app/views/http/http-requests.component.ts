import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ControllerClient } from '../../client';
import { DebugRequest } from '@deepkit/framework-debug-api';
import { Router } from '@angular/router';

@Component({
    styles: [`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
    `],
    template: `
        <dui-input placeholder="Filter" round semiTransparent lightFocus [(ngModel)]="filterQuery"></dui-input>

        <dui-table style="flex: 1 1" [trackFn]="trackFn" [items]="requests"
                   (dbclick)="open($event)"
                   selectable defaultSort="started" defaultSortDirection="desc" noFocusOutline>
            <dui-table-column [width]="90" name="method" header="Method"> </dui-table-column>
            <dui-table-column class="text-tabular" [width]="130" name="statusCode" header="Status"></dui-table-column>
            <dui-table-column [width]="220" name="url" header="URL"></dui-table-column>
            <dui-table-column class="text-tabular" [width]="220" name="clientIp" header="Client IP"></dui-table-column>
            <dui-table-column [width]="190" name="started" header="Started">
                <div class="text-tabular" *duiTableCell="let row">
                    {{row.started/1000|date:'MMM d, y, h:mm:ss.SSS'}}
                </div>
            </dui-table-column>
            <dui-table-column [width]="190" name="ended" header="Took">
                <div class="text-tabular" *duiTableCell="let row">
                    {{row.ended ? (row.ended - row.started)/1000 : '-'}}ms
                </div>
            </dui-table-column>
        </dui-table>
    `,
})
export class HttpRequestsComponent implements OnInit {
    requests: DebugRequest[] = [];

    filterQuery: string = '';

    trackFn = (i: number, item: DebugRequest) => item.id;

    constructor(
        private client: ControllerClient,
        private cd: ChangeDetectorRef,
        private router: Router,
    ) {
    }

    open(request: DebugRequest) {
        this.router.navigate(['/http/request', request.id]);
    }

    filter(items: any[], query: string) {
        if (!query) return items;
        return items.filter(v => v.path.toLowerCase().includes(query.toLowerCase()));
    }

    async ngOnInit() {
        this.requests = await this.client.debug.httpRequests();
        console.log('this.requests', this.requests);
        this.cd.detectChanges();
    }
}


// Funding is definitely still on the horizon, but I have no idea how to kickstart it concrete. I think about it a lot, but it's a project that costs a lot of time and not sure if it will be worth it.
