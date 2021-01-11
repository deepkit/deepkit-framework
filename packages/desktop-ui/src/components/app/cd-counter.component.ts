import { Component, Input } from "@angular/core";

@Component({
    selector: 'dui-cd-counter',
    template: `{{counter}}`
})
export class CdCounterComponent {
    private i = 0;

    @Input() name?: string;

    get counter() {
        this.i++;
        return this.i;
    }
}
