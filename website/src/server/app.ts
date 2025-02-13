import { HttpKernel } from '@deepkit/http';
import { App } from '@deepkit/app';
import { ApplicationServer, FrameworkModule, onServerMainBootstrap } from '@deepkit/framework';
import { AppConfig } from './config';
import { MainController } from '@app/server/controller/main.controller';
import { Search } from '@app/server/search';
import { OpenAI } from 'openai';
import {
    fineTuneTest1,
    fineTuneTest1Check,
    fineTuneTest1Model,
    mlGenAnswerCommand,
    mlGenQuestionCommand,
} from '@app/server/commands/ml-fine-tuning';
import { WebController } from '@app/server/controller/web.controller';
import { PageProcessor } from '@app/server/page-processor';
import { Questions, testQuestions, testTestFunction } from '@app/server/questions';
import { registerBot } from '@app/server/commands/discord';
import { MainDatabase } from '@app/server/database';
import { Database } from '@deepkit/orm';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Url } from '@app/server/url';
import { MarkdownParser } from '@app/common/markdown';
import { migrate } from '@app/server/commands/migrate';
import { importExamples, importQuestions } from '@app/server/commands/import';
import { BenchmarkController, BenchmarkHttpController } from '@app/server/controller/benchmark.controller';
import {
    AngularNodeAppEngine,
    createNodeRequestHandler,
    isMainModule,
    writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

(global as any).window = undefined;
(global as any).document = undefined;

const ngApp = new AngularNodeAppEngine();

const app = new App({
    config: AppConfig,
    controllers: [
        MainController,
        WebController,
        BenchmarkController,
        BenchmarkHttpController,
    ],
    providers: [
        PageProcessor,
        Questions,
        Search,
        Url,
        MarkdownParser,
        { provide: Database, useClass: MainDatabase },
        {
            provide: OpenAI, useFactory(openaiApiKey: AppConfig['openaiApiKey']) {
                return new OpenAI({ apiKey: openaiApiKey });
            },
        },
        {
            provide: Client, useFactory() {
                return new Client({
                    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
                    intents: [
                        GatewayIntentBits.Guilds,
                        GatewayIntentBits.GuildMessages,
                        GatewayIntentBits.MessageContent,
                        GatewayIntentBits.GuildMembers,
                        GatewayIntentBits.GuildMessageReactions,
                    ],
                });
            },
        },
    ],
    imports: [
        new FrameworkModule({
            migrateOnStartup: true, //yolo
            httpRpcBasePath: 'api/v1',
            publicDir: browserDistFolder,
        }),
    ],
});


app.command('search:index', async (search: Search) => await search.index());
app.command('search:find', async (query: string, search: Search) => {
    console.log(await search.find(query));
});
app.command('ml:gen-questions', mlGenQuestionCommand);
app.command('ml:gen-answers', mlGenAnswerCommand);
app.command('ml:test', testTestFunction);
app.command('ml:q', testQuestions);
app.command('ml:fine-tune', fineTuneTest1);
app.command('ml:fine-tune:check', fineTuneTest1Check);
app.command('ml:fine-tune:model', fineTuneTest1Model);
app.command('import:questions', importQuestions);
app.command('import:examples', importExamples);
app.command('migrate', migrate);

app.listen(onServerMainBootstrap, registerBot);
app.listen(onServerMainBootstrap, (event, parser: MarkdownParser) => parser.load());

app.loadConfigFromEnv({ namingStrategy: 'same', prefix: 'app_', envFilePath: ['local.env'] });

if (isMainModule(import.meta.url)) {
    // started file directly (without angular dev server)
    void app.run();
}

process.on('unhandledRejection', (error) => {
    console.error('unhandledRejection', error);
});

let waitForClose = Promise.resolve();
if ((global as any).server) {
    waitForClose = ((global as any).server as ApplicationServer).close();
}

const server = (global as any).server = app.get(ApplicationServer);
let baseUrl = '';
const waitBootstrap = waitForClose.then(() => server.start({
    listenOnSignals: false,
    // startHttpServer: false,
})).then(() => {
    let host = server.getHttpHost();
    if (host?.startsWith('0.0.0.0')) {
        host = 'localhost' + host.substr(7);
    }
    baseUrl = `http://${host}/`;
});
const http = app.get(HttpKernel);
const handler = http.createHandler(true);

// every request in angular dev server is handled by this function
export const reqHandler = createNodeRequestHandler(async (req, res) => {
    await waitBootstrap;

    // if req wants to upgrade to websocket, we need to handle this here
    if (req.headers.upgrade === 'websocket') {
        return;
    }

    try {
        await handler(req, res, async (error?: any) => {
            if (error) {
                console.log('error from handler', error);
                res.statusCode = 500;
                res.end('Internal Server Error');
                return;
            }
            const response = await ngApp.handle(req, { baseUrl });
            if (response) {
                await writeResponseToNodeResponse(response, res);
            }
        });
    } catch (error) {
        console.log('handleRequest error', error);
    }
});
