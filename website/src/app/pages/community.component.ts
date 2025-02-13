import { Component } from '@angular/core';
import { AppTitle } from '@app/app/components/title';


@Component({
    styles: [`
      .app-boxes-small {
        margin: 50px 00px;
      }

      .app-box {
        text-align: center;

        &:hover {
          text-decoration: none;
        }
      }
    `],
    imports: [
        AppTitle
    ],
    template: `
        <app-title value="Community"></app-title>
        <div class="app-content-full">
            <div class="app-banner left">
                <div class="wrapper">
                    <h1>COMMUNITY</h1>

                    <div>
                        <p>
                            Be part of a community of developers who appreciate high performance and clean SOLID TypeScript code.
                            Get free support, keep up to date, and chat with like-minded people.
                        </p>
                        <p>
                            Join our Discord to get in touch with the community and the developers.
                        </p>
                    </div>
                </div>
            </div>
            <div class="wrapper">
                <div class="app-boxes-small">
                    <a class="app-box hover" target="_blank" href="https://discord.gg/U24mryk7Wq">
                        <div class="icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>

                        <h3>Discord</h3>
                    </a>

                    <a class="app-box hover" target="_blank" href="https://github.com/deepkit/deepkit-framework/discussions">
                        <div class="icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                            </svg>
                        </div>

                        <h3>GitHub</h3>
                    </a>

                    <a class="app-box hover" target="_blank" href="https://twitter.com/deepkitIO">
                        <div class="icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                            </svg>
                        </div>

                        <h3>Twitter</h3>
                    </a>
                </div>
            </div>
        </div>
    `
})
export class CommunityComponent {
}
