import { Component } from "@angular/core";
import { ClassSchema } from "@deepkit/type";
import { BrowserState } from "../browser-state";

@Component({
    selector: 'orm-browser-list',
    template: `
        <ng-container *ngFor="let db of state.databases">
            <dui-list-item [active]="state.database === db && !state.entity"
            (onSelect)="state.database = db; state.entity = undefined;"
            >{{db.name}} ({{db.adapter}})</dui-list-item>

            <dui-list-item [active]="state.entity === entity" 
            (onSelect)="state.database = db; state.entity = entity;"
            *ngFor="let entity of filterEntitiesToList(db.getClassSchemas())">
                <div style="margin-left: 15px">
                    {{entity.getClassName()}} 
                    <ng-container *ngIf="state.hasAddedItems(db.name, entity.getName()) as items">({{state.getAddedItems(db.name, entity.getName()).length}})</ng-container>
                </div>
            </dui-list-item>
        </ng-container>
    `
})
export class DatabaseBrowserListComponent {
    constructor(
        public state: BrowserState,
    ) {
    }

    filterEntitiesToList(schemas: ClassSchema[]): ClassSchema[] {
        return schemas.filter(v => v.name && !v.name.startsWith('@:embedded/'));
    }
}