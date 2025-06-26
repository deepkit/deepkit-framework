import { Component, EventEmitter, Output } from '@angular/core';
import { empty, size } from '@deepkit/core';
import { ButtonComponent, CloseDialogDirective, DialogActionsComponent, DialogComponent, DuiDialog } from '@deepkit/desktop-ui';
import { Changes } from '@deepkit/type';
import { BrowserState } from '../browser-state';
import { ControllerClient } from '../client';
import { JsonPipe, KeyValuePipe } from '@angular/common';

@Component({
    template: `
      @for (kv of state.changes|keyvalue; track kv) {
        <div>
          @if (!empty(kv.value)) {
            <h4>{{ getEntityName(kv.key) }} changes</h4>
            <table>
              @for (kv2 of kv.value|keyvalue; track kv2) {
                <tr>
                  <td style="padding-right: 15px;">
                    {{ kv2.value.pk|json }}
                  </td>
                  <td>
                    {{ stringifyChanges(kv2.value.changes) }}
                  </td>
                </tr>
              }
            </table>
          }
        </div>
      }

      <table>
        @for (kv of state.addedItems|keyvalue; track kv) {
          <tr>
            <td>{{ getEntityName(kv.key) }}</td>
            <td>
              {{ kv.value.length }} new record/s
            </td>
          </tr>
        }
      </table>

      <table>
        @for (kv of state.deletions|keyvalue; track kv) {
          <tr>
            <td>{{ getEntityName(kv.key) }}</td>
            <td>
              delete {{ size(kv.value) }} record/s
            </td>
          </tr>
        }
      </table>

      <dui-dialog-actions>
        <dui-button closeDialog>Cancel</dui-button>
        <dui-button (click)="commit()" primary>Commit</dui-button>
      </dui-dialog-actions>
    `,
    styles: [`
        table td {
            padding: 2px 5px;
        }
    `],
    imports: [DialogActionsComponent, ButtonComponent, CloseDialogDirective, JsonPipe, KeyValuePipe],
})
export class DatabaseCommitComponent {
    @Output() stateChange = new EventEmitter();
    @Output() done = new EventEmitter();

    empty = empty;
    size = size;

    // changes: {name: string, changes: {pk: string, change;}[]}[] = [];

    constructor(
        protected controllerClient: ControllerClient,
        protected duiDialog: DuiDialog,
        protected dialog: DialogComponent,
        public state: BrowserState,
    ) {
    }

    getEntityName(name: string): string {
        return this.state.getEntityFromCacheKey(name).getClassName();
    }

    stringifyChanges(changes: Changes<any>): string {
        if (changes.$set) return Object.entries(changes.$set).map(v => v[0] + '=' + v[1]).join(', ');
        if (changes.$unset) return Object.entries(changes.$unset).map(v => 'delete ' + v[0]).join(', ');
        if (changes.$inc) return Object.entries(changes.$inc).map(v => 'increase ' + v[0] + ' by ' + v[1]).join(', ');
        return '';
    }

    async commit() {
        try {
            await this.state.commit();
            await this.state.resetAll();
            this.done.emit();
            this.dialog.close();
        } catch (error: any) {
            this.duiDialog.alert('Error saving', String(error));
            console.log(error);
        }
    }

}
