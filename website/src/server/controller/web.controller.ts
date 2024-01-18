import { http, HttpQuery } from "@deepkit/http";
import { Logger } from "@deepkit/logger";
import { OpenAI } from "openai";
import { PageProcessor } from "@app/server/page-processor";

export class WebController {
    constructor(
        private logger: Logger,
        private openAi: OpenAI,
        private pageProcessor: PageProcessor,
    ) {
    }

    @http.GET('/ask')
    async ask(prompt: HttpQuery<string>, url?: HttpQuery<string>): Promise<string> {
        const page = url ? await this.pageProcessor.read(url) : '';
        const model = 'gpt-3.5-turbo-16k';

        prompt = `
I'm on the page ${url} with following content:

\`\`\`
${page}
\`\`\`

----

My question: ${prompt}
        `;

        const messages: { role: 'system' | 'user' | 'assistant' | 'function', content: string }[] = [
            { role: 'system', content: 'You are a documentation chat bot that helps the user to understand a TypeScript framework called Deepkit.' },
            { role: 'user', content: prompt },
        ];

        const completion = await this.openAi.chat.completions.create({ messages, model, stream: true }, {stream: true});

        for await (const message of completion) {
            console.log('message', message.choices[0].delta.content);
        }

        return 'Sorry, I could not find an answer to your question.';
    }

}
