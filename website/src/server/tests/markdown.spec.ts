import { expect, test } from '@jest/globals';
import { MarkdownParser } from "@app/common/markdown";

test('parse markdown', async () => {
    const parser = new MarkdownParser();
    await parser.load();

    const page = parser.parse(`
# Title

This is a paragraph.
    `);

    expect(page.title).toBe('Title');
    expect(page.body).toMatchObject({
        tag: 'div',
        children: [
            { tag: 'h1', props: { id: 'title' }, children: ['Title'] },
            "\n",
            { tag: 'p', props: undefined, children: ['This is a paragraph.'] },
        ]
    })
});

test('parse code', async () => {
    const parser = new MarkdownParser();
    await parser.load();

    const page = parser.parse(`
\`\`\`typescript title="app.ts"
let code = 1;
\`\`\`
    `);

    expect(page.body).toMatchObject({
        tag: 'pre',
        props: {
            meta: 'title="app.ts"',
            class: 'language-typescript'
        },
        children: ['let code = 1;']
    })
});
