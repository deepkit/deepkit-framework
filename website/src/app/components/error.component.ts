import { Component, Input } from '@angular/core';


@Component({
    selector: 'app-error',
    imports: [],
    template: `
        @if (error) {
          <h4>Error</h4>
          <p style="color: red">{{error}}</p>
        }
        `
})
export class ErrorComponent {
    @Input() error?: any;
}
