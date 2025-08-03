import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'dw-footer',
    template: `
        <div class="wrapper">
            <div class="copyright">
                <img alt="logo text" src="../../assets/images/deepkit_white_text.svg"/>
                <div class="text">
                    © {{year}} Deepkit®
                </div>
            </div>
            <nav class="links">
<!--                <a routerLink="/about-us">About us</a>-->
                <a routerLink="/contact">Contact</a>
                <a routerLink="/data-protection">Data protection</a>
            </nav>
        </div>
        <div class="wrapper made-in">
            Made in Germany
        </div>
    `,
    imports: [
        RouterLink
    ],
    styleUrls: ['./footer.component.css']
})
export class FooterComponent {
    get year() {
        return new Date().getFullYear();
    }
}
