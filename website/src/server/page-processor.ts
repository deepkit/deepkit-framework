import { readFile } from 'fs/promises';
import { join } from 'path';
import { magicSeparator, Page } from '@app/common/models';
import { MarkdownParser } from '@app/common/markdown';
import { getCurrentDirName } from '@deepkit/core';
import { findParentPath } from '@deepkit/app';

const pagesDir = findParentPath('src/pages', getCurrentDirName()) || '';

export class PageProcessor {
    constructor(protected parser: MarkdownParser) {
    }

    async read(url: string, lang: string = 'en'): Promise<string> {
        url = url.replace(/[^a-zA-Z0-9\-_\/]/g, '');
        const file = url + '.md';
        const originalPath = join(pagesDir, file);
        const translated = join(pagesDir, '../translations', lang, file);
        if (lang === 'en') return await readFile(originalPath, 'utf8');
        try {
            return await readFile(translated, 'utf8');
        } catch {
            return await readFile(originalPath, 'utf8');
        }
    }

    async parse(url: string, lang: string): Promise<Page> {
        await this.parser.load();
        const content = await this.read(url, lang);
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
            questions.push({ title: question, content: answer });
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
            i++;
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
            result.push({ props, content });
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
                    content: withContent ? v.content : '',
                };
            });
        } catch (error: any) {
            throw new Error(`Could not parse ${path}: ${String(error)}`);
        }
    }
}
