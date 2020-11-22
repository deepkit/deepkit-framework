import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ControllerClient} from '../../client';
import {Route} from '@deepkit/framework-debug-shared';

@Component({
  template: `
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
      <dui-table-column [width]="220" name="description"></dui-table-column>
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


    /*:host > * {*/
    /*  flex: 0 0 100%;*/
    /*}*/

    .center {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class HttpComponent implements OnInit {
  public routes: Route[] = [];
  public selected: Route[] = [];

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
    this.routes = await this.controllerClient.debug.routes();
    console.log('this.routes', this.routes);
    this.cd.detectChanges();
  }

}
