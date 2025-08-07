import { AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PlatformHelper } from '@app/app/utils';
import { HeaderLogoComponent, HeaderNavComponent } from '@app/app/components/header.component.js';
import { TableOfContentComponent } from '@app/app/components/table-of-content.component.js';
import { ContentTextService } from '@app/app/components/content-text.component.js';
import { DuiApp } from '@deepkit/desktop-ui';
import { docs } from '@app/common/docs';

@Component({
    imports: [
        RouterLinkActive,
        RouterLink,
        FormsModule,
        RouterOutlet,
        HeaderNavComponent,
        HeaderLogoComponent,
        TableOfContentComponent,
    ],
    standalone: true,
    styleUrls: ['./documentation.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <div class="wrapper">
        <nav [class.showMenu]="showMenu" #nav>
          <dw-header-logo />

          <div class="container">
            @for (doc of docs; track $index) {
              <div class="category">
                <div class="category-title">{{ doc.category }}</div>
                @for (page of doc.pages; track $index) {
                  <a routerLinkActive="active" [routerLinkActiveOptions]="pathMatchOnly"
                     routerLink="/documentation/{{ page.path }}">{{ page.title }}</a>
                }
              </div>
            }
          </div>
        </nav>
        <div class="page">
          <dw-header-nav />
          <div class="content-wrapper">
            <div class="menu-trigger" [class.open]="showMenu"><a (click)="showMenu=!showMenu" class="button">Chapters</a></div>
            <div (click)="showMenu=false; true">
              <router-outlet></router-outlet>
            </div>
          </div>
        </div>
      </div>
      <app-table-of-content />
    `,
})
export class DocumentationComponent implements AfterViewInit, OnDestroy {
    docs = docs;
    pathMatchOnly: IsActiveMatchOptions = {
        fragment: 'ignored',
        matrixParams: 'ignored',
        paths: 'exact',
        queryParams: 'ignored',
    };

    showMenu: boolean = false;
    scrolled = false;

    @ViewChild('nav') nav?: ElementRef;

    sub: Subscription;

    constructor(
        public platform: PlatformHelper,
        public router: Router,
        public contentTextService: ContentTextService,
        private duiApp: DuiApp,
    ) {
        this.sub = router.events.subscribe(() => {
            this.showMenu = false;
            setTimeout(() => this.scrollToActiveLink(), 100);
        });
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    protected scrollToActiveLink() {
        if (!this.platform.isBrowser() || !this.nav) return;

        const active = this.nav.nativeElement.querySelectorAll('a.active');
        active.forEach((el: any) => {
            const rect = el.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            if (isVisible) return;
            this.scrolled = true;
            el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        });
    }

    ngAfterViewInit() {
        setTimeout(() => this.scrollToActiveLink(), 100);
    }
}
