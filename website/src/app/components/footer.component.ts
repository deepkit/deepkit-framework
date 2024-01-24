import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'dw-footer',
    standalone: true,
    template: `
        <div class="wrapper">
            <div class="copyright">
                <img alt="logo text" src="../../assets/images/deepkit_white_text.svg" />
                <div class="text">© {{ year }} Deepkit®</div>
            </div>
            <nav class="social">
                <a href="https://discord.gg/U24mryk7Wq" target="_blank">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </a>
                <a href="https://github.com/deepkit/deepkit-framework" target="_blank">
                    <img width="24" height="24" alt="github" src="/assets/images/github.svg" />
                </a>
                <a href="https://twitter.com/deepkitIO" target="_blank">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                        <path
                            id="twitter-logo"
                            fill="white"
                            d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
                        />
                    </svg>
                </a>
            </nav>
            <nav class="links">
                <a routerLink="/about-us">About us</a>
                <a routerLink="/contact">Contact</a>
                <a routerLink="/data-protection">Data protection</a>
            </nav>
        </div>
        <div class="wrapper made-in">Made in Germany</div>
    `,
    imports: [RouterLink],
    styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
    get year() {
        return new Date().getFullYear();
    }
}
