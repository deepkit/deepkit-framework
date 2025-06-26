import { html } from '@deepkit/template';

export class Website {
    constructor(
        protected props: { children: any[], title?: string },
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
                    {this.props.children}
                </div>
            </div>
            </body>
            </html>
        </>;
    }
}
