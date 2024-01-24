import { NgForOf, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SearchComponent } from '@app/app/components/search.component';

@Component({
    selector: 'dw-header',
    standalone: true,
    template: `
        <div class="wrapper" [class.showMenu]="showMenu">
            <a class="logo" routerLink="/"
                ><img alt="logo" style="width: 24px; height: 30px;" src="/assets/images/deepkit_white.svg"
            /></a>
            <!--            <a class="logo" *ngIf="startPage" routerLink="/"><img src="/assets/images/deepkit_white_text.svg"/></a>-->

            <app-search *ngIf="search"></app-search>

            <a class="burger" (click)="toggleMenu()">
                <svg width="21px" height="16px" viewBox="0 0 21 16" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                        <g id="burger" [attr.fill]="'white'">
                            <rect id="Rectangle" x="0" y="0" width="21" height="2"></rect>
                            <rect id="Rectangle" x="0" y="7" width="21" height="2"></rect>
                            <rect id="Rectangle" x="0" y="14" width="21" height="2"></rect>
                        </g>
                    </g>
                </svg>
            </a>
            <nav class="main">
                <a routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" routerLink="/">Framework</a>
                <a routerLinkActive="active" routerLink="/library">Libraries</a>
                <!--                <a routerLinkActive="active" routerLink="/enterprise">Enterprise</a>-->
                <a routerLinkActive="active" routerLink="/community">Community</a>
                <a routerLinkActive="active" routerLink="/documentation">Documentation</a>
            </nav>
        </div>
    `,
    host: {
        '[class.sticky]': 'sticky',
    },
    imports: [RouterLink, RouterLinkActive, NgForOf, NgIf, ReactiveFormsModule, SearchComponent],
    styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
    public menu = '';
    @Input() sticky: boolean = false;
    @Input() search: boolean = false;

    protected lastTimeout: any;

    public showMenu: boolean = false;

    constructor(
        protected cd: ChangeDetectorRef,
        public router: Router,
    ) {
        router.events.subscribe(() => {
            this.menu = '';
            this.showMenu = false;
            this.cd.detectChanges();
        });
    }

    toggleMenu() {
        this.showMenu = !this.showMenu;
        this.cd.detectChanges();
    }

    open(menu: string) {
        if (this.lastTimeout) {
            clearTimeout(this.lastTimeout);
        }

        this.menu = menu;
        this.cd.detectChanges();
    }

    close(menu: string) {
        this.lastTimeout = setTimeout(() => {
            if (this.menu === menu) {
                this.menu = '';
            }
            this.cd.detectChanges();
        }, 200);
    }
}
