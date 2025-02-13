import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-empty',
    template: `
        <router-outlet></router-outlet>
    `,
    imports: [
        RouterOutlet
    ]
})
export class EmptyComponent {}
