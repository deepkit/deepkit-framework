import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Optional, Output, SkipSelf, ViewChild } from "@angular/core";
import { arrayRemoveItem } from "@deepkit/core";
import { DialogComponent, DropdownComponent, ReactiveChangeDetectionModule } from "@deepkit/desktop-ui";
import { ClassSchema, getForeignKeyHash, PropertySchema } from "@deepkit/type";
import { BrowserState } from "src/app/browser-state";

@Component({
    template: `
    <dui-dialog *ngIf="!parent" class="class-field-dialog" noPadding [backDropCloses]="true" [visible]="browserStack.length > 0" (closed)="done.emit()" minWidth="80%" minHeight="60%">
        <div class="layout">
        <div class="header" *ngIf="state.database && foreignSchema">
            <span *ngFor="let browser of browserStack">
                 &raquo; {{browser.foreignSchema?.getClassName()}}
            </span>
        </div>

        <!-- <ng-container *ngIf="state.database && entity && browserStack.length === 0">
            <orm-browser-database-browser 
            [dialog]="true"
            [selectedPkHashes]="selectedPkHashes" 
            [multiSelect]="property.isArray" 
            (select)="onSelect($event)"
            [database]="state.database" [entity]="entity"></orm-browser-database-browser>
        </ng-container> -->

        <ng-container *ngFor="let browser of browserStack">
            <orm-browser-database-browser *ngIf="state.database && browser.foreignSchema" 
            [class.hidden]="browserStack.length > 0 && browser !== browserStack[browserStack.length - 1]"
            [dialog]="true"
            [withBack]="browser !== browserStack[0]"
            (back)="popBrowser()"
            [selectedPkHashes]="browser.selectedPkHashes" 
            [multiSelect]="browser.property.isArray" 
            (select)="browser.onSelect($event)"
            [database]="state.database" [entity]="browser.foreignSchema"></orm-browser-database-browser>
        </ng-container>
        </div>
    </dui-dialog>
    `,
    styles: [`
        .layout {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        ::ng-deep dui-window-content > div.class-field-dialog {
            padding: 0 !important;
            padding-top: 15px !important;
        }

        .header {
            flex: 0 0 18px;
            padding: 0 15px;
            padding-top: 4px;
        }

        orm-browser-database-browser {
            flex: 1;
        }

        .hidden { display: none; }
    `]
})
export class ClassInputComponent implements AfterViewInit, OnChanges, OnDestroy {
    @Input() row: any;
    @Input() property!: PropertySchema;

    selectedPkHashes: string[] = [];

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    browserStack: ClassInputComponent[] = [];

    foreignSchema?: ClassSchema;

    getLastBrowser(): ClassInputComponent | undefined {
        if (!this.browserStack.length) return undefined;
        return this.browserStack[this.browserStack.length - 1];
    }

    constructor(
        public host: ElementRef,
        public state: BrowserState,
        public cd: ChangeDetectorRef,
        @Optional() @SkipSelf() public parent: ClassInputComponent,
    ) {
        this.browserStack.push(this);
    }

    popBrowser() {
        const last = this.browserStack[this.browserStack.length - 1];
        if (!last) return;

        last.closeAndDone();
    }

    closeAndDone() {
        this.done.emit();
    }

    registerBrowser(child: ClassInputComponent) {
        this.browserStack.push(child);
        this.browserStack = this.browserStack.slice();
        this.cd.detectChanges();
    }

    deregisterBrowser(child: ClassInputComponent) {
        arrayRemoveItem(this.browserStack, child);
        this.cd.detectChanges();
    }

    ngOnDestroy() {
        this.done.emit(); //make sure that the column is disabled editing when this is destroyed
        if (this.parent) this.parent.deregisterBrowser(this);
    }

    ngOnChanges() {
        this.foreignSchema = this.property.getResolvedClassSchema();
        if (this.property.isReference) {
            this.loadSelection();
        }
    }

    loadSelection() {
        if (!this.foreignSchema) return;
        this.selectedPkHashes = [];

        const value = this.row[this.property.name];
        if (value) {
            if (this.property.isArray) {
            } else {
                if (this.state.isIdWrapper(value)) {
                    this.selectedPkHashes.push(this.state.extractHashFromIdWrapper(value));
                } else {
                    this.selectedPkHashes.push(getForeignKeyHash(this.row, this.property));
                }
            }
        }
    }

    onSelect(event: { items: any[], pkHashes: string[] }) {
        if (!this.foreignSchema) return;

        if (this.property.isArray) {
            // this.row[this.property.name] = this.selection;
        } else {
            const selected = event.items[0];
            if (selected) {
                if (this.state.isNew(selected)) {
                    this.state.connectNewItem(selected, this.row, this.property);
                    this.row[this.property.name] = this.state.getNewItemIdWrapper(selected);
                } else {
                    this.row[this.property.name] = this.foreignSchema.extractPrimaryKey(selected);
                }
            } else if (this.property.isOptional || this.property.isNullable) {
                this.row[this.property.name] = this.property.isNullable ? null : undefined;
            }
            setTimeout(() => {
                this.popBrowser();
                ReactiveChangeDetectionModule.tick();
            }, 60);
        }
    }

    ngAfterViewInit() {
        if (this.property.isReference) {
            this.foreignSchema = this.property.getResolvedClassSchema();
            this.loadSelection();
            if (this.parent) {
                this.parent.registerBrowser(this);
            } else {
                this.cd.detectChanges();
            }
        }
    }
}