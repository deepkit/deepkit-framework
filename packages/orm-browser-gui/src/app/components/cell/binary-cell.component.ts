import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { fromBuffer } from 'file-type/browser';
import * as FileSaver from 'file-saver';

@Component({
    template: `
        <ng-container *ngIf="image">
            <img [src]="image|objectURL"
                 [openDropdownHover]="drop"
                 style="max-height: 100%; max-width: 50px;"/>
            <dui-dropdown #drop [width]="450" [height]="450">
                <div style="height: 100%; display: flex; justify-content: center; align-items: center">
                    <img [src]="image|objectURL" style="max-height: 100%; max-width: 100%;"/>
                </div>
            </dui-dropdown>
        </ng-container>
        <dui-icon name="download" *ngIf="model.byteLength > 0" (click)="download(); $event.preventDefault(); $event.stopPropagation()" clickable></dui-icon>
        <div class="bytes">
            {{model.byteLength|fileSize}}
        </div>
    `,
    styles: [`
        :host {
            height: 100%;
            display: flex;
            align-items: center;
        }

        dui-icon, .bytes {
            margin-left: 6px;
            color: var(--text-light);
            font-size: 12px;
        }

    `]
})
export class BinaryCellComponent implements OnInit, OnChanges {
    @Input() model: any;
    @Input() property!: PropertySchema;

    image?: Uint8Array;
    ext: string = 'bin';

    constructor(public cd: ChangeDetectorRef) {
    }

    async display() {
        const type = await fromBuffer(this.model);
        this.image = undefined;
        if (type?.mime?.startsWith('image/')) {
            this.image = this.model;
            this.ext = type?.ext;
        }

        this.cd.detectChanges();
    }

    download() {
        const blob = new Blob([this.model]);
        FileSaver.saveAs(blob, this.property.name + '.' + this.ext);
    }

    ngOnChanges(): void {
        this.display();
    }

    ngOnInit(): void {
        this.display();
    }

}
