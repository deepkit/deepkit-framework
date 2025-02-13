import { Component } from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AppTitle } from '@app/app/components/title';
import { HeaderComponent } from '@app/app/components/header.component';
import { FooterComponent } from '@app/app/components/footer.component';

@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet, AppTitle, HeaderComponent, FooterComponent],
    template: `
        <app-title value="Deepkit Enterprise TypeScript Framework"></app-title>

        <dw-header [sticky]="activeRoute.firstChild?.snapshot?.data?.stickyHeader" [search]="activeRoute.firstChild?.snapshot?.data?.search"></dw-header>

        <router-outlet></router-outlet>

        <dw-footer *ngIf="withFooter"></dw-footer>
    `,
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    constructor(public activeRoute: ActivatedRoute, private viewportScroller: ViewportScroller) {
        viewportScroller.setOffset([0, 84]);
        viewportScroller.setHistoryScrollRestoration('auto');
    }

    get withFooter(): boolean {
        return this.activeRoute.firstChild?.snapshot?.data.footer !== false;
    }
}
