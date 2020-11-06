import {Configuration, injectable} from '@deepkit/framework';

@injectable()
export class Website {
    constructor(
        protected props: { title?: string },
        protected children: string[],
        protected config: Configuration
    ) {
    }

    async render() {
        return <html>
        <head>
            <title>{this.props.title} - My Website!</title>
        </head>

        <body style="display: flex; justify-content: center">
        <div style="max-width: 800px; border: 1px solid silver;">
            Hi {this.config.get('TEST')}

            <div class="content">
                {this.children}
            </div>
        </div>
        </body>
        </html>;
    }
}
