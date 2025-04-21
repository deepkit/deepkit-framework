import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppTitle } from '@app/app/components/title';


@Component({
    styles: [`
        .offering {
            text-align: center;
            padding: 150px 0;

            .wrapper {
                max-width: 870px;
            }

            &.bg {
                border: 1px solid #262626;
                background: #15191C;
            }
        }

        .reference {

            .wrapper {
                max-width: 860px;
                padding: 100px 50px;
            }

            &.bg {
                border: 1px solid #262626;
                background: #15191C;
            }
        }

        .box3 {
            margin: 35px auto;
            grid-auto-flow: column;
            grid-template-columns: unset;
            justify-content: center;

            .app-box {
                width: 260px;
                max-width: 100%;
            }
        }

        .app-box {
            position: relative;
            text-align: left;

            h2 {
                font-size: 18px;
                margin: 2px 0;
                color: white;
            }

            .price {
                color: #B4B4B4;
                font-size: 18px;
            }

            ul {
                margin-top: 15px;
                font-size: 13px;
                list-style: none;
                padding: 0;

                li {
                    padding: 0;
                }
            }

            .footer {
                font-size: 13px;
                color: var(--color-grey);
            }
        }

        h3.text {
            margin-bottom: 25px;
        }

        .how {
            margin-top: 50px;
            text-align: left;

            h3 {
                font-weight: bold;
                font-size: 18px;
                margin: 15px 0;
            }
        }

    `],
    imports: [
        RouterLink,
        AppTitle
    ],
    template: `
        <app-title value="Enterprise"></app-title>
        <div class="app-content-full">
            <div class="app-banner">
                <div class="wrapper">
                    <img class="deepkit" alt="deepkit logo" src="/assets/images/deepkit_white_text.svg"/>

                    <h1>ENTERPRISE</h1>
                    <h2>GERMAN ENGINEERING</h2>

                    <div>
                        <p>
                            Deepkit is a German software engineering company building high-fidelity and top-notch web
                            applications with over 20 years experience, specialised in
                            machine learning, delivering scalable and innovative solutions.
                        </p>

                        <p>
                            We design and implement complex custom web applications for international and<br/>
                            local clients using our unique high-performance TypeScript tech stack.<br/>
                            If you have a project and need help, contact us or book us now.
                        </p>

                        <div style="margin-top: 50px;">
                            <a href="mailto:info@deepkit.io" class="button big">Contact us</a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="offering">
                <div class="wrapper">

                    <h2>Support</h2>

                    <h3 class="text">
                        Need help with your project?<br/>
                        TypeScript, Deepkit, Angular, C++, Python, Machine Learning &hyphen; We got you covered.
                    </h3>

                    <h3 class="text">
                        No matter if you need a jumpstart, a code review, pair programming session,<br/>
                        architecture consulting, or just a helping hand.
                    </h3>

                    <div class="app-boxes box3">
                        <div class="app-box">
                            <h2>Startup Boost</h2>
                            <div class="price">Free</div>
                            <ul>
                                <li>Unlimited requests</li>
                                <li>Training</li>
                                <li>Architecture</li>
                                <li>Design Patterns</li>
                                <li>Code examples</li>
                                <li>Managed via Discord</li>
                                <li>Deepkit</li>
                            </ul>
                            <p class="footer">
                                For Startups using Deepkit<br/>
                                for the first time.
                            </p>
                            <div class="actions">
                                <a target="_blank" href="https://discord.com/invite/PtfVf7B8UU" class="button big">Join
                                    Discord</a>
                            </div>
                        </div>
                        <div class="app-box">
                            <h2>Unlimited Support</h2>
                            <div class="price">Monthly $6,999</div>
                            <ul>
                                <li>Unlimited requests</li>
                                <li>Answer within 12h</li>
                                <li>Pair programming</li>
                                <li>Code examples</li>
                                <li>Via Discord/Microsoft Teams</li>
                                <li>Design Patterns</li>
                                <li>Invite your team</li>
                                <li>Deepkit, TypeScript, HTML</li>
                            </ul>
                            <p class="footer">
                                Cancel anytime
                            </p>
                            <div class="actions">
                                <a href="https://buy.stripe.com/6oE5m34V58KrcYE8wx" target="_blank" class="button big">Book now</a>
                            </div>
                        </div>
                        <div class="app-box">
                            <h2>Teaching</h2>
                            <div class="price">$2,300/day</div>
                            <ul>
                                <li>On-site or remote</li>
                                <li>Deepkit, TypeScript, HTML</li>
                                <li>Design Patterns</li>
                                <li>Architecture</li>
                                <li>Performance</li>
                                <li>Testing</li>
                                <li>Machine Learning</li>
                                <li>Database design</li>
                            </ul>
                            <p class="footer">
                                2-7 days
                            </p>
                            <div class="actions">
                                <a href="https://book.stripe.com/14k15N73d6Cj2k0144" target="_blank" class="button big">Book now</a>
                            </div>
                        </div>
                    </div>

                    <div class="how">
                        <h3 class="text">
                            How does it work?
                        </h3>

                        <p>
                            You book us and we help you. We use Discord/Microsoft Teams for communication and screen
                            sharing.
                        </p>

                        <p>
                            <strong>Unlimited Support:</strong> Limited to 1 project. Cancel anytime. When you cancel,
                            no money refund. If we cancel, we refund the remaining time. Does not include writing code
                            for you,
                            except for code examples. Free high priority bug fix for any bug in Deepkit.
                            See <a routerLink="/terms">Terms of Service</a> for details.
                        </p>
                    </div>
                </div>
            </div>

            <div class="offering bg">
                <div class="wrapper">
                    <h2>Custom Prototypes</h2>

                    <h3 class="text">
                        We put money where our mouth is. We build your prototype in 1-3 weeks.
                    </h3>

                    <h3 class="text">
                        No sales, no project manager, no scrum, no bullshit. Just results.
                    </h3>

                    <div class="app-boxes box3">
                        <div class="app-box">
                            <h2>Prototype</h2>
                            <div class="price">One-time $18,995</div>
                            <ul>
                                <li>No hidden fees or ongoing costs</li>
                                <li>Proof of concept</li>
                                <li>Bootstrap your project</li>
                                <li>Based on your design</li>
                                <li>Low test coverage</li>
                                <li>Essential documentation</li>
                                <li>Modern enterprise patterns</li>
                                <li>TypeScript, HTML, CSS, C++, Python</li>
                            </ul>

                            <p class="footer">
                                1-2 weeks turnaround
                            </p>
                            <div class="actions">
                                <a href="https://buy.stripe.com/28o29RcnxaSz5wc9AE" target="_blank" class="button big">Buy now</a>
                            </div>
                        </div>
                        <div class="app-box">
                            <h2>Prototype+</h2>
                            <div class="price">One-time $28,995</div>
                            <ul>
                                <li>No hidden fees or ongoing costs</li>
                                <li>Proof of concept</li>
                                <li>Bootstrap your project</li>
                                <li>Based on your design</li>
                                <li>High test coverage</li>
                                <li>Extensive documentation</li>
                                <li>Modern enterprise patterns</li>
                                <li>TypeScript, HTML, CSS, C++, Python</li>
                            </ul>

                            <p class="footer">
                                3 weeks turnaround
                            </p>
                            <div class="actions">
                                <a href="https://buy.stripe.com/14k6q7afpaSz1fWcMP" target="_blank" class="button big">Buy now</a>
                            </div>
                        </div>
                        <div class="app-box">
                            <h2>Machine Learning</h2>
                            <div class="price">One-time $39,995</div>
                            <ul>
                                <li>No hidden fees or ongoing costs</li>
                                <li>Test your hypothesis</li>
                                <li>Custom architecture/models</li>
                                <li>Data cleaning</li>
                                <li>Data augmentation & gen</li>
                                <li>Python or C++</li>
                                <li>Based on Pytorch/Libtorch</li>
                                <li>Including server/GUI</li>
                                <li>Training costs excluded</li>
                            </ul>

                            <p class="footer">
                                2-3 weeks turnaround
                            </p>
                            <div class="actions">
                                <a href="https://buy.stripe.com/7sIbKrafp0dV3o45kp" target="_blank" class="button big">Buy now</a>
                            </div>
                        </div>
                    </div>

                    <div class="how">
                        <h3 class="text">
                            We build prototypes and MVPs
                        </h3>
                        <p>
                            We build prototypes and small MVPs to test if your hypothesis/business model works &hyphen;
                            fast.
                            Our prototype is a fully functional application that implements the core features of your
                            product. It's not a mockup, it's not a wireframe,
                            it's not a clickable demo. It's a real application that you can use and test in production.
                        </p>

                        <p>
                            The prototype we build is not a throw-away. It's the foundation of your product.
                            We build it with the same quality standards as we would build a production application,
                            but with less features and less tests. We apply the same architecture and design patterns
                            as we would do for a production application to ensure that the prototype can be easily
                            extended and maintained, eventually becoming the production application.
                        </p>
                    </div>

                    <div class="app-boxes"
                         style="grid-auto-flow: column; grid-auto-columns: minmax(450px, auto); grid-template-columns: unset;">
                        <div class="app-box">
                            <h2>MVP</h2>
                            <ul>
                                <li>
                                    Need a more advanced prototype? We can build it for you. Contact us for a quote.
                                </li>
                                <li>
                                    Per project price (not hourly)
                                </li>
                                <li>
                                    No hidden fees or ongoing costs
                                </li>
                                <li>
                                    Optionally with design and branding
                                </li>
                            </ul>
                            <div class="actions">
                                <a href="mailto:info@deepkit.io" class="button">Contact us</a>
                            </div>
                        </div>
                        <div class="app-box">
                            <h2>Investment</h2>
                            <ul>
                                <li>
                                    No money, but a great idea?
                                </li>
                                <li>
                                    We develop the prototype
                                </li>
                                <li>
                                    We get a share of your company (at least 50%)
                                </li>
                                <li>
                                    We create design and branding
                                </li>
                                <li>
                                    We pay for the server costs
                                </li>
                            </ul>
                            <div class="actions">
                                <a href="mailto:info@deepkit.io" class="button">Contact us</a>
                            </div>
                        </div>
                    </div>

                    <div class="how">
                        <h3 class="text">
                            How does it work?
                        </h3>

                        <p>
                            You send us your idea, ideally with fully designed screens. We review it and tell you
                            if it's doable in the given time frame. If yes, we send you an invoice and start
                            working.<br/>
                            We primarily use Angular, TypeScript, and Deepkit Framework with NodeJS, Docker, and
                            PostgreSQL to build your prototype and
                            host on Google Cloud Platform. We use Discord or Microsoft Teams for communication, screen
                            sharing,and presentation of status updates. See <a routerLink="/terms">Terms of Service</a> for details.
                        </p>
                    </div>
                </div>
            </div>

<!--            <div class="references offering">-->
<!--                <h2>References</h2>-->

<!--                <h3 class="text">-->
<!--                    We build application for startups and enterprises since over 18 years. Our open-source projects have-->
<!--                    over 1 million downloads each month.-->
<!--                </h3>-->

<!--                <h3 class="text">-->
<!--                    Here are some of our highlights.-->
<!--                </h3>-->

<!--                <div style="margin-bottom: 50px;">-->
<!--                    eCommerce Platform-->
<!--                    // Design Tool-->
<!--                    // TypeRunner-->
<!--                    // Deepkit Framework-->
<!--                    // Deepkit ML-->
<!--                    // AETROS-->
<!--                    // JARVES-->
<!--                </div>-->

<!--                <div class="reference bg">-->
<!--                    <div class="wrapper">-->
<!--                        <h3>eCommerce Platform</h3>-->

<!--                        <p>-->
<!--                            Custom eCommerce platform for a German company with several million Euros revenue-->
<!--                            per year. From the design to the implementation, we built the whole platform from scratch using-->
<!--                            TypeScript everywhere-->
<!--                        </p>-->

<!--                        <p>-->
<!--                            Frontend and Backend based on Angular with SSR, Deepkit Framework, PostgreSQL, and Docker.-->
<!--                        </p>-->
<!--                    </div>-->
<!--                </div>-->
<!--            </div>-->
        </div>
    `
})
export class EnterpriseComponent {
}
