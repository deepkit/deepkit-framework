import { Component } from '@angular/core';
import { LibrariesComponent } from '@app/app/pages/libraries/libraries.component.js';

@Component({
    template: `
      <app-libraries />`,
    imports: [
        LibrariesComponent,
    ],
})
export class StartpageComponent {
}
