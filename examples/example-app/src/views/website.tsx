import { html } from '@deepkit/template';

export class Website {
    constructor(
        protected props: { title?: string },
        protected children: string,
    ) {
    }

    async render() {
        return <>
            {html('<!DOCTYPE html>')}
            <html>
            <head>
                <title>{this.props.title} - My Website!</title>
                <link rel="stylesheet" href="/style.css"/>
            </head>

            <body>
            <div class="frame">
                <div class="content">
                    {this.children}
                </div>
            </div>
            </body>
            </html>
        </>;
    }
}
