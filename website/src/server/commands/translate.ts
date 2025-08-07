import { OpenAI } from 'openai';
import { Logger } from '@deepkit/logger';
import { docs, libraries } from '@app/common/docs';
import { join } from 'path';
import { getCurrentDirName } from '@deepkit/core';

const dirname = getCurrentDirName();

export async function translateCommand(
    lang: string = 'cn',
    logger: Logger,
    openAi: OpenAI,
) {
    const supportedLanguages = ['cn', 'kr', 'de', 'fr', 'pl'];

    if (!supportedLanguages.includes(lang)) {
        throw new Error(`Unsupported language: ${lang}`);
    }

    logger.info(`Starting translation to ${lang}...`);

    const files = [
        join(dirname, '../../common/docs.ts'),
    ];

    const completion = await openAi.chat.completions.create({
        model: 'gpt-4o', messages: [
            {
                role: 'system',
                content: `
You are a helpful assistant that translates technical documentation and code comments into ${lang}.
Please ensure the translation is accurate and maintains the original meaning.
You get from the user either just markdown or TypeScript code. Keep the structure and formatting of the original text
as much as possible, and do not add any additional explanations or comments.
Do not translate any code, only the comments and markdown.
If you encounter any text that is not in English, do not translate it.
`.trim(),
            },
            {
                role: 'user',
                content: `Translate the following text into ${lang}:\n\n${docs.join('\n')}\n\n${libraries.join('\n')}`,
            },
        ],
    });

    if (completion.choices.length === 0) {
        throw new Error('No translation received from OpenAI');
    }
    const translatedText = completion.choices[0].message.content;
    logger.info(`Translation to ${lang} completed.`);
    console.log(translatedText);
}
