import { NgModule } from '@angular/core';
import {
    TableCellDirective,
    TableColumnDirective,
    TableComponent,
    TableCustomHeaderContextMenuDirective,
    TableCustomRowContextMenuDirective,
    TableHeaderDirective
} from "./table.component";
import { CommonModule } from "@angular/common";
import { DuiIconModule } from "../icon";
import { DuiSplitterModule } from "../splitter";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { DuiButtonModule } from "../button";

export * from "./table.component";

@NgModule({
    exports: [
        TableCellDirective,
        TableColumnDirective,
        TableHeaderDirective,
        TableComponent,
        TableCustomRowContextMenuDirective,
        TableCustomHeaderContextMenuDirective,
    ],
    declarations: [
        TableCellDirective,
        TableColumnDirective,
        TableHeaderDirective,
        TableComponent,
        TableCustomRowContextMenuDirective,
        TableCustomHeaderContextMenuDirective,
    ],
    providers: [],
    imports: [
        CommonModule,
        DuiIconModule,
        DuiSplitterModule,
        ScrollingModule,
        DuiButtonModule,
    ],
})
export class DuiTableModule {
}
