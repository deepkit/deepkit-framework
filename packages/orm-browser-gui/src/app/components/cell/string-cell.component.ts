import { Component, Input } from '@angular/core';
import { Type } from '@deepkit/type';

@Component({
    template: `{{model}}`,
    standalone: false
})
export class StringCellComponent {
    @Input() model: any;
    @Input() type!: Type;
}
