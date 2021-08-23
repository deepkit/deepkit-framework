import { AppModuleConfig } from '@deepkit/app';
import { t } from '@deepkit/type';

export const config = new AppModuleConfig({
    listen: t.boolean.default(true),
    excludeGroups: t.array(t.string).default(['app-static']),
    basePath: t.string.default('/api'),
    markdown: t.string.description('Markdown to display at the overview page')
        .default(`
        # API

        Welcome to this official API. Click on a route and press "Open console" to execute a HTTP call right in your browser.

        You can change this markdown content with "markdown" or "markdownFile" option.

        `),
    markdownFile: t.string.description('Path to a markdown file to display at the overview page').optional
});
