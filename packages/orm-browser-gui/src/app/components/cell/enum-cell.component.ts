import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from "@angular/core";
import { getEnumKeyLabelMap } from "@deepkit/core";
import { PropertySchema } from "@deepkit/type";

@Component({
    template: `{{keyValueMap ? keyValueMap.get(row[property.name]) : row[property.name]}}`
})
export class EnumCellComponent implements OnChanges, OnInit {
    @Input() row: any;
    @Input() property!: PropertySchema;

    keyValueMap?: Map<any, string>;

    ngOnInit() {
        this.load();
    }
    
    ngOnChanges() {
        this.load();
    }

    load() {
        this.keyValueMap = getEnumKeyLabelMap(this.property.classType || {});
    }
}