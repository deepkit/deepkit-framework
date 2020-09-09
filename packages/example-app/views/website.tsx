import {Configuration, injectable, template} from '@super-hornet/framework';

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

        <body>
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

        </body>
        </html>;
    }
}