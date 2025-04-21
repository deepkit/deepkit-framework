import { OpenAI, toFile } from 'openai';
import { findParentPath } from '@deepkit/app';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import glob from 'tiny-glob';
import { getSystem } from '../questions';
import { magicSeparator } from '@app/common/models';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class Context {
    messages: OpenAI.ChatCompletionMessageParam[] = [];

    async addSystem(additionalText: string) {
        this.messages.push({ role: 'system', content: await getSystem(additionalText) });
    }

    addUser(content: string) {
        this.messages.push({ role: 'user', content });
    }

    addAssistant(content: string) {
        this.messages.push({ role: 'assistant', content });
    }
}

function getPath(path: string) {
    const baseDir = findParentPath('src/pages', __dirname);
    if (!baseDir) throw new Error('Could not find base dir');
    return join(baseDir, path);
}


class Page {
    questions: { question: string, answer: string }[] = [];
    textPath: string;
    questionsPath: string;
    fileContent?: string;

    constructor(public path: string) {
        this.textPath = getPath('documentation/' + path);
        this.questionsPath = getPath('questions/' + path);
    }

    async getContent(): Promise<string> {
        if (this.fileContent) return this.fileContent;
        return this.fileContent = await readFile(this.textPath, 'utf8');
    }

    async getFullContent(): Promise<string> {
        //loads all files, e.g. if this.path is http.md, we load http.md, then all files in http/*.md
        const dir = this.textPath.replace('.md', '');
        const content: string[] = [
            await this.getContent()
        ];
        const files = await glob('**/*.md', { cwd: dir });
        for (const file of files) {
            const path = this.path.replace('.md', '') + ':' + file.replace('.md', '').replace(/\//g, ':');
            const page = `
            # ${path}
            ${(await readFile(join(dir, file), 'utf8')).replace(/^#/g, '##')}
            `
            content.push(page);
        }

        return content.join('\n\n');
    }

    getNextUnansweredQuestions(limit: number = 5): string[] {
        const result: string[] = [];
        for (const question of this.questions) {
            if (!question.answer) result.push(question.question);
            if (result.length >= limit) break;
        }
        return result;
    }

    async save() {
        await writeFile(this.questionsPath, this.generateContent());
    }

    generateContent(): string {
        const texts: string[] = [];
        for (const question of this.questions) {
            texts.push(`User: ${question.question}\nAssistant: ${question.answer}`);
        }
        return texts.join(`\n\n${magicSeparator}\n\n`);
    }

    async load() {
        const text = await readFile(this.questionsPath, { encoding: 'utf8', flag: 'a+' });
        const texts = text.split(magicSeparator);
        for (const text of texts) {
            const userStart = text.indexOf('User:') + 'User:'.length;
            const assistantStart = text.indexOf('\nAssistant:');
            const question = text.substr(userStart, assistantStart - userStart).trim();
            if (!question) continue;
            const answer = text.substr(assistantStart + '\nAssistant:'.length).trim();
            this.questions.push({ question, answer });
        }
    }

    setQuestions(questions: string[]) {
        for (const question of questions) {
            if (this.questions.find(v => v.question === question)) continue;
            this.questions.push({ question, answer: '' });
        }
    }

    setAnswers(questions: string[], answers: string[]) {
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const index = this.questions.findIndex(v => v.question === q);
            if (index === -1) throw new Error('Could not find question ' + q);
            if (!answers[i]) continue;
            this.questions[index].answer = answers[i];
        }
    }
}


async function genQuestionPrompt(page: Page) {
    return `
Given text from a documentation:

${await page.getFullContent()}

-----------

We have already following questions:

${page.questions.map((v, i) => `${i + 1}. ${v.question}`).join('\n')}

-----------

Generate me 30 new possible questions, chat messages, or queries a user could write.
Formulate the question like a real user with a chat bot would do. Also include not only questions but also queries like \`How to ...\` or \`How does ...\` etc.
Also include questions about abstract topics around the framework like for example "Why do I need a framework?", "What is a framework?", "Why use Dependency Injection?", "What is Dependency Injection?" etc.
Also include comparison questions like "How does Deepkit compare to NestJS?" or "How does Deepkit compare to TypeORM/Prisma?" etc.
`;
}

async function genAnswerPrompt(page: Page, questions: string[]) {
    return `
Given text from the documentation:

${await page.getFullContent()}


-----------


Answer me following questions and prefix the answer with \`Assistant: <number>.\` and then the number. For example:

---
Assistant: 1. <answer 1>
Assistant: 2. <answer 2>
---

Also output example code if possible and output it as a Markdown code block.

${questions.map((v, i) => `${i + 1}. ${v}`).join('\n')}
`;
}

function parseQuestions(text: string): string[] {
    //Input: 1. xxx\n2. xxx\n3. xxx
    //Output: [xxx, xxx, xxx]
    return text.split('\n').map((line) => {
        return line.slice(line.indexOf('.') + 1);
    }).map(v => v.trim()).filter(v => !!v);
}

function parseAnswers(text: string): string[] {
    return ('\n' + text).split('\nAssistant: ').map((line) => {
        return line.slice(line.indexOf('.') + 1);
    }).map(v => v.trim()).filter(v => !!v);
}


const model = 'gpt-3.5-turbo-16k';

export async function mlGenQuestionCommand(
    file: string,
    openai: OpenAI
) {
    const context = new Context();
    await context.addSystem('');

    const page = new Page(file);
    await page.load();

    context.addUser(await genQuestionPrompt(page));

    console.log(context.messages[1].content);

    const completion = await openai.chat.completions.create({
        messages: context.messages,
        model,
    });

    const result = completion.choices[0]['message']['content'];
    if (!result) throw new Error('No result');

    const questions = parseQuestions(result);
    console.log('questions', questions);
    page.setQuestions(questions);
    await page.save();
}

export async function mlGenAnswerCommand(
    file: string,
    openai: OpenAI
) {
    const context = new Context();

    await context.addSystem('');
    const page = new Page(file);
    await page.load();

    const questions = page.getNextUnansweredQuestions(5);
    console.log(questions);
    if (questions.length === 0) throw new Error('No more questions to answer');

    context.addUser(await genAnswerPrompt(page, questions));

    const completion = await openai.chat.completions.create({
        messages: context.messages,
        model: model,
    });

    const result = completion.choices[0]['message']['content'];
    if (!result) throw new Error('No result');

    console.log('result', result);
    const answers = parseAnswers(result);
    console.log('answers', answers);
    page.setAnswers(questions, answers);
    await page.save();
}

export async function fineTuneTest1(
    file: string,
    openai: OpenAI,
) {
    //go through all .md files in src/pages
    const pagesDir = findParentPath('src/pages/documentation');
    if (!pagesDir) throw new Error('Could not find pages directory');

    const files = await glob('**/*.md', { cwd: pagesDir });
    const dataset: any[] = [];

    const page = new Page(file);
    await page.load();

    for (const q of page.questions) {
        if (!q.answer) continue;

        const messages = [
            { role: 'system', content: 'You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit.' },
            { role: 'user', content: q.question },
            { role: 'assistant', content: q.answer }
        ]
        dataset.push(messages);
    }

    // for (const file of files) {
    //     const content = await readFile(join(pagesDir, file), 'utf8');
    //     const path = file.replace('.md', '');
    //
    //     const messages = [
    //         { role: 'system', content: 'You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit.' },
    //         { role: 'user', content: 'Tell me about ' + path },
    //         { role: 'assistant', content }
    //     ]
    //     dataset.push(messages);
    // }

    const jsonl = dataset.map(v => JSON.stringify({ messages: v })).join('\n');
    const aiFile = await openai.files.create({
        file: await toFile(Buffer.from(jsonl), 'file-abc123'),
        purpose: 'fine-tune',
    })
    const training = await openai.fineTuning.jobs.create({
        training_file: aiFile.id,
        model: 'gpt-3.5-turbo',
        hyperparameters: {
            n_epochs: 25
        }
    });
    console.log('training', training);
}

export async function fineTuneTest1Check(
    openai: OpenAI,
) {
    const list = await openai.fineTuning.jobs.list();
    for (const item of list.getPaginatedItems()) {
        console.log(item);
    }
}

export async function fineTuneTest1Model(
    model: string,
    prompt: string,
    openai: OpenAI,
) {
    const messages: any = [
        { role: 'system', content: 'You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit.' },
        { role: 'user', content: prompt }
    ];

    const completion = await openai.chat.completions.create({
        messages,
        model,
        temperature: 0.3,
        stream: true,
    }, { stream: true });

    for await (const message of completion) {
        let text = message.choices[0].delta.content || '';
        process.stdout.write(text);
    }
}
