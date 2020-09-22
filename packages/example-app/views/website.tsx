import {Configuration, injectable, template} from '@deepkit/framework';

@injectable()
export class Website {
    constructor(
        protected props: { title?: string },
        protected contents: string[],
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
            <nav>
                <a href="/">Home</a>
                <a href="/product">Product</a>
                <a href="/about">About</a>
            </nav>

            Hi {this.config.get('TEST')}

            <div id="asd" class="content">
                {this.contents}
            </div>

            {/*Database: {await this.database.getData()}*/}
        </div>
        </body>
        </html>;
    }
}
