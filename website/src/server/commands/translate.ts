import { OpenAI } from 'openai';
import { Logger } from '@deepkit/logger';
import path from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getCurrentDirName } from '@deepkit/core';
import { docs, libraries, texts } from '@app/common/docs';

const currentDir = getCurrentDirName();

const languages: Record<string, string> = {
    zh: '中文 (Chinese)',
    ko: '한국어 (Korean)',
    ja: '日本語 (Japanese)',
    de: 'Deutsch (German)',
    pl: 'Polski (Polish)',
};

const instruction = `
Words like Error, Class, Function, Variable, Type, Interface, Method, Property, Parameter, Argument, Return Value, refer to TypeScript technical terms.
Keep error message strings in code in English, do not translate them.
You can translate code comments if needed, but do not translate any code itself.
Make sure to keep technical terms in English if possible. If it would sound weird or uncommon in the target language even in technical documentations, keep it in English.
`;

async function translateLabels(openAi: OpenAI, lang: string, labels: string[]): Promise<Record<string, string>> {
    const completion = await openAi.chat.completions.create({
        model: 'gpt-5', messages: [
            {
                role: 'system',
                content: `
You are a helpful assistant that translates technical documentation and code comments into ${lang} ${languages[lang]}.
Please ensure the translation is accurate and maintains the original meaning.
You get from the user either just markdown or TypeScript code. Keep the structure and formatting of the original text
as much as possible, and do not add any additional explanations or comments.
Do not translate any code, only the comments and markdown.
If you encounter any text that is not in English, do not translate it.

Return a map of translations for the provided labels.
Example input: ["Hello World", "This is a test"]
Example output: {
    "Hello World": "你好，世界",
    "This is a test": "这是一个测试"
}
Make sure to use the language: ${lang} ${languages[lang]} and return the translations in a JSON format only (no markdown).
`.trim(),
            },
            {
                role: 'user',
                content: `Translate the following text into ${lang} ${languages[lang]}: ${JSON.stringify(labels)}`,
            },
        ],
    });

    if (completion.choices.length === 0) {
        throw new Error('No translation received from OpenAI');
    }
    let translatedText = completion.choices[0].message.content;
    if (!translatedText) return {};

    if (translatedText.startsWith('```json')) translatedText.slice(7, -3);
    try {
        return JSON.parse(translatedText);
    } catch (error) {
        throw new Error(`Failed to parse translation response: ${translatedText}`);
    }
}

async function translateMarkdown(openAi: OpenAI, lang: string, source: string): Promise<string> {
    const completion = await openAi.chat.completions.create({
        model: 'gpt-5', messages: [
            {
                role: 'system',
                content: `
You are a helpful assistant that translates technical documentation and code comments into ${lang} ${languages[lang]}.
Please ensure the translation is accurate and maintains the original meaning.
You get from the user either just markdown or TypeScript code. Keep the structure and formatting of the original text
as much as possible, and do not add any additional explanations or comments.
Do not translate any code, only the comments and markdown.
If you encounter any text that is not in English, do not translate it.

Return markdown in the same format as the input, but translated to ${lang} ${languages[lang]}. 
Do not return any additional text or explanations.
${instruction}

Make sure to also translate link titles, headings, and any other text that is not code.
`.trim(),
            },
            {
                role: 'user',
                content: `Translate the following text into ${lang} ${languages[lang]}: ${source}`,
            },
        ],
    });

    if (completion.choices.length === 0) {
        throw new Error('No translation received from OpenAI');
    }
    let translatedText = completion.choices[0].message.content;
    return translatedText || '';
}

export function readTranslationsFile(lang: string, name: string): Record<string, string> {
    const filePath = path.join(currentDir, '../../translations', lang, `${name}.json`);
    try {
        const content = readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        return {};
    }
}

export function readTranslationDocumentationPage(lang: string, page: string): string {
    const filePath = path.join(currentDir, '../../translations/documentation', lang, page);
    try {
        return readFileSync(filePath, 'utf8');
    } catch (error) {
        return '';
    }
}

function writeTranslationsFile(lang: string, name: string, translations: Record<string, string>) {
    const filePath = path.join(currentDir, '../../translations', lang, `${name}.json`);
    writeFileSync(filePath, JSON.stringify(translations, null, 2), 'utf8'); // Ensure the file exists
}

function filterAlreadyTranslated(translations: Record<string, string>, labels: string[]): string[] {
    return labels.filter(label => !translations[label]);
}

// navigation, startpage, etc. All in one big mapping file that is loaded at once.
async function translateBasics(openAi: OpenAI, lang: string) {
    const labels: string[] = [];

    for (const [key, label] of Object.entries(texts)) {
        labels.push(label);
    }

    for (const category of docs) {
        if (category.category) labels.push(category.category);
        if (category.category === 'API') continue;
        for (const page of category.pages) {
            labels.push(page.title);
        }
    }

    for (const category of libraries) {
        if (category.category) labels.push(category.category);
        for (const item of category.items) {
            labels.push(item.title);
            labels.push(item.description);
        }
    }

    const translations = readTranslationsFile(lang, 'basics');
    const filtered = filterAlreadyTranslated(translations, labels);
    const newTranslations = await translateLabels(openAi, lang, filtered);
    Object.assign(translations, newTranslations);
    writeTranslationsFile(lang, 'basics', translations);
}

type Hash = string;
type Path = string;
type TranslationState = Record<Path, Hash>;

function readState(lang: string): TranslationState {
    const dir = path.join(currentDir, '../../translations', lang);
    const filePath = path.join(dir, 'state.json');
    console.log('readState', filePath);
    mkdirSync(dir, { recursive: true });
    try {
        const content = readFileSync(filePath, 'utf8');
        return JSON.parse(content) || {};
    } catch (error) {
        return {};
    }
}

function writeState(lang: string, state: TranslationState) {
    const filePath = path.join(currentDir, '../../translations', lang, 'state.json');
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

async function translateDocumentationPage(openAi: OpenAI, state: TranslationState, lang: string, page: string) {
    console.log(`Translating ${page} to ${lang}...`);
    const filePath = path.join(currentDir, '../../pages/documentation', page);
    const binary = readFileSync(filePath);
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', binary)).toString('hex');
    if (state[page] === hash) {
        console.log(`Skipping ${page}, already translated.`);
        return;
    }

    const content = binary.toString('utf8');
    const translatedContent = await translateMarkdown(openAi, lang, content);
    const outputPath = path.join(currentDir, '../../translations', lang, 'documentation', page);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, translatedContent, 'utf8');
    state[page] = hash;
    writeState(lang, state);
    console.log(`Translated ${page} to ${lang}`);
    console.log(translatedContent);
}

export async function translateCommand(
    lang: string = 'cn',
    logger: Logger,
    openAi: OpenAI,
) {
    if (!languages[lang]) {
        throw new Error(`Unsupported language: ${lang}`);
    }

    logger.info(`Starting translation to ${lang}...`);
    const dir = path.join(currentDir, '../../translations', lang);
    mkdirSync(dir, { recursive: true });

    await translateBasics(openAi, lang);
    const state = readState(lang);

    for (const category of docs) {
        for (const page of category.pages) {
            const pagePath = (page.path || 'index') + '.md';
            if (pagePath.startsWith('desktop-ui/')) continue;
            await translateDocumentationPage(openAi, state, lang, pagePath);
        }
    }
    // await translateDocumentationPage(openAi, state, lang, 'introduction.md');
}
