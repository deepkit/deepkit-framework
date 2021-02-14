import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { getEnumKeyLabelMap } from '@deepkit/core';
import { PropertySchema } from '@deepkit/type';

@Component({
    template: `{{keyValueMap ? keyValueMap.get(model) : model}}`
})
export class EnumCellComponent implements OnChanges, OnInit {
    @Input() model: any;
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
