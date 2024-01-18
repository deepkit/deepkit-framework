import { Component, Input } from "@angular/core";
import { NgIf } from "@angular/common";

@Component({
    selector: 'app-error',
    standalone: true,
    imports: [
        NgIf
    ],
    template: `
        <ng-container *ngIf="error">
            <h4>Error</h4>
            <p style="color: red">{{error}}</p>
        </ng-container>
    `
})
export class ErrorComponent {
    @Input() error?: any;
}
