import { Component } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AppTitle } from '@app/app/components/title';
import { DuiApp, DuiStyleComponent } from '@deepkit/desktop-ui';
import { ContentTextService } from '@app/app/components/content-text.component.js';
import { Translation } from '@app/app/components/translation.js';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, AppTitle, DuiStyleComponent],
    host: {
        '[class.content-text-dark]': 'contentTextService.darkMode()'
    },
    template: `
      <dui-style />
      <app-title value="Deepkit Enterprise TypeScript Framework" />

      @if (translation.ready()) {
        <router-outlet></router-outlet>
      }

      <!--      @if (withHeader) {-->
      <!--        <dw-header-->
      <!--          [hideLogo]="activeRoute.firstChild?.snapshot?.data?.hideLogo"-->
      <!--          [float]="activeRoute.firstChild?.snapshot?.data?.floatHeader"-->
      <!--          [search]="activeRoute.firstChild?.snapshot?.data?.search" />-->
      <!--      }-->

      <!--      <router-outlet></router-outlet>-->

      <!--      @if (withFooter) {-->
      <!--        <dw-footer></dw-footer>-->
      <!--      }-->
    `,
    styleUrls: ['./app.component.css'],
})
export class AppComponent {
    constructor(
        public activeRoute: ActivatedRoute,
        private viewportScroller: ViewportScroller,
        public contentTextService: ContentTextService,
        public translation: Translation,
        private duiApp: DuiApp,
    ) {
        // viewportScroller.setOffset([0, 84]);
        // duiApp.disableThemeDetection();
        // duiApp.setDarkMode(false);
        viewportScroller.setHistoryScrollRestoration('auto');
    }
}
