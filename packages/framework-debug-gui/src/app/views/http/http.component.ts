import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ControllerClient} from '../../client';
import {Route, Workflow} from '@deepkit/framework-debug-shared';

@Component({
  template: `
    <div class="header">
      <h4>HTTP Workflow</h4>
    </div>
    <div style="height: 250px; margin-bottom: 10px; overflow: auto" class="overlay-scrollbar-small">
      <app-workflow [workflow]="workflow"></app-workflow>
    </div>
    <div class="header">
      <h4>HTTP Routes</h4>
      <dui-input placeholder="Filter" round semiTransparent lightFocus [(ngModel)]="filterQuery"></dui-input>
    </div>
    <dui-table
      style="flex: 1 1"
      [items]="filter(routes, filterQuery)" [(selected)]="selected" selectable defaultSort="path" noFocusOutline>
      <dui-table-column [width]="90" name="HTTP">
        <ng-container *duiTableCell="let row">
          {{row.httpMethod.toUpperCase()}}
        </ng-container>
      </dui-table-column>
      <dui-table-column [width]="220" name="path"></dui-table-column>
      <dui-table-column [width]="220" name="controller"></dui-table-column>
      <dui-table-column [width]="220" name="body">
        <ng-container *duiTableCell="let row">
          {{row.bodyPropertySchema ? row.bodyPropertySchema.toString() : ''}}
        </ng-container>
      </dui-table-column>
      <dui-table-column [width]="220" name="groups">
        <ng-container *duiTableCell="let row">
          {{row.groups.join(', ')}}
        </ng-container>
      </dui-table-column>
      <dui-table-column [width]="220" name="description"></dui-table-column>
      <dui-table-column [width]="220" name="category"></dui-table-column>
    </dui-table>
    <!--    <div>-->
    <!--      <div class="center" *ngIf="!route">No route selected</div>-->
    <!--      <ng-container *ngIf="route">-->
    <!--        <div class="text-selection">{{route.httpMethod}} {{route.path}}</div>-->
    <!--      </ng-container>-->
    <!--    </div>-->
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .header {
      display: flex;
      margin-bottom: 15px;
    }

    .header dui-input {
      margin-left: auto;
    }
  `]
})
export class HttpComponent implements OnInit {
  public routes: Route[] = [];
  public selected: Route[] = [];

  public workflow?: Workflow;

  public filterQuery: string = '';
  constructor(
    private controllerClient: ControllerClient,
    public cd: ChangeDetectorRef,
  ) {
  }

  get route() {
    return this.selected[0];
  }

  filter(items: Route[], filter: string): any[] {
    if (!filter) return items;

    return items.filter(v => (v.path.includes(filter) || v.controller.includes(filter)));
  }

  async ngOnInit(): Promise<void> {
    [this.routes, this.workflow] = await Promise.all([
      this.controllerClient.debug.routes(),
      this.controllerClient.getWorkflow('http')
    ]);

    this.cd.detectChanges();
  }

}
