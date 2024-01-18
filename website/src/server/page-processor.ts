import {findParentPath} from "@deepkit/app";
import {readFile} from "fs/promises";
import {join} from "path";
import {magicSeparator, Page,} from "@app/common/models";
import {MarkdownParser} from "@app/common/markdown";

export class PageProcessor {
    constructor(protected parser: MarkdownParser) {
    }

    async read(url: string): Promise<string> {
        const dir = findParentPath('src/pages', __dirname);
        if (!dir) throw new Error('Pages folder not found');
        url = url.replace(/[^a-zA-Z0-9\-_\/]/g, '');
        const file = url + '.md';
        return await readFile(join(dir, file), 'utf8');
    }

    async parse(url: string): Promise<Page> {
        const content = await this.read(url);
        const page = this.parser.parse(content);
        page.url = url;
        return page;
    }

    async parseQuestions(path: string, top: number = 5): Promise<{ title: string, content: string }[]> {
        const content = await this.read('questions/' + path);
        const texts = content.split(magicSeparator);
        const questions: { title: string, content: string }[] = [];
        for (const text of texts) {
            if (text.trim() === '') continue;
            const userStart = text.indexOf('user:') + 'user:'.length;
            const assistantStart = text.indexOf('\nassistant:');
            const question = text.substr(userStart, assistantStart - userStart).trim();
            if (!question) continue;
            const answer = text.substr(assistantStart + '\nassistant:'.length).trim();
            questions.push({title: question, content: answer});
            if (questions.length >= top) break;
        }
        return questions;
    }

    parseFile(content: string, properties: string[], top: number = 10000): {
        props: { [name: string]: string },
        content: string
    }[] {
        const result: { props: { [name: string]: string }, content: string }[] = [];

        const texts = content.split(magicSeparator);
        let i = 0;
        for (const text of texts) {
            i++
            if (text.trim() === '') continue;
            const props: { [name: string]: string } = {};
            let lastPropIndex = 0;
            for (const property of properties) {
                const optional = property.startsWith('?');
                const name = property.replace('?', '');
                let start = text.indexOf(name + ':', lastPropIndex);
                if (start === -1) {
                    if (optional) {
                        props[name] = '';
                        continue;
                    }
                    throw new Error(`Property ${property} not found at entry ${i}`);
                }
                start += name.length + 1;
                const end = text.indexOf('\n', start);
                if (end === -1) throw new Error(`Property newline ${property} not found`);
                lastPropIndex = end + 1;
                const value = text.slice(start, end).trim();
                props[name] = value;
            }
            const content = text.slice(lastPropIndex);
            result.push({props, content});
            if (result.length >= top) break;
        }

        return result;
    }

    async parseExamples(path: string, withContent: boolean = false, top: number = 5): Promise<{
        title: string,
        url: string,
        content: string
    }[]> {
        const content = await this.read('examples/' + path);
        try {
            return this.parseFile(content, ['title', '?url'], top).map(v => {
                return {
                    title: v.props.title,
                    url: v.props.url,
                    content: withContent ? v.content : ''
                };
            });
        } catch (error: any) {
            throw new Error(`Could not parse ${path}: ${String(error)}`);
        }
    }
}
