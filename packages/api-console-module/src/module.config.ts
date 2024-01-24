export class Config {
    /**
     * @description If true serves the application at given URL path.
     */
    listen: boolean = true;

    path: string = '/api';

    /**
     * @description Markdown to display at the overview page.
     */
    markdown: string = `
        # API

        Welcome to this official API. Click on a route and press "Open console" to execute a HTTP call right in your browser.

        You can change this markdown content with "markdown" or "markdownFile" option.

        `;

    /**
     * @description Path to a markdown file to display at the overview page.
     */
    markdownFile?: string;
}
