import { MarkdownParser } from '@app/common/markdown';
import { AngularListener } from '@app/server/angular';
import { registerBot } from '@app/server/commands/discord';
import { importExamples, importQuestions } from '@app/server/commands/import';
import { migrate } from '@app/server/commands/migrate';
import {
    fineTuneTest1,
    fineTuneTest1Check,
    fineTuneTest1Model,
    mlGenAnswerCommand,
    mlGenQuestionCommand,
} from '@app/server/commands/ml-fine-tuning';
import { BenchmarkController, BenchmarkHttpController } from '@app/server/controller/benchmark.controller';
import { MainController } from '@app/server/controller/main.controller';
import { WebController } from '@app/server/controller/web.controller';
import { MainDatabase } from '@app/server/database';
import { PageProcessor } from '@app/server/page-processor';
import { Questions, testQuestions, testTestFunction } from '@app/server/questions';
import { Search } from '@app/server/search';
import { Url } from '@app/server/url';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { OpenAI } from 'openai';
import { join } from 'path';

import { App, findParentPath, onAppExecute } from '@deepkit/app';
import { FrameworkModule, onServerMainBootstrap } from '@deepkit/framework';
import { serveStaticListener } from '@deepkit/http';
import { Database } from '@deepkit/orm';

import { AppConfig } from './config';

(global as any).window = undefined;
(global as any).document = undefined;

new App({
    config: AppConfig,
    controllers: [MainController, WebController, BenchmarkController, BenchmarkHttpController],
    listeners: [AngularListener],
    providers: [
        PageProcessor,
        Questions,
        Search,
        Url,
        MarkdownParser,
        { provide: Database, useClass: MainDatabase },
        {
            provide: OpenAI,
            useFactory(openaiApiKey: AppConfig['openaiApiKey']) {
                return new OpenAI({ apiKey: openaiApiKey });
            },
        },
        {
            provide: Client,
            useFactory() {
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
        }),
    ],
})
    .command('search:index', async (search: Search) => await search.index())
    .command('search:find', async (query: string, search: Search) => {
        console.log(await search.find(query));
    })
    .command('ml:gen-questions', mlGenQuestionCommand)
    .command('ml:gen-answers', mlGenAnswerCommand)
    .command('ml:test', testTestFunction)
    .command('ml:q', testQuestions)
    .command('ml:fine-tune', fineTuneTest1)
    .command('ml:fine-tune:check', fineTuneTest1Check)
    .command('ml:fine-tune:model', fineTuneTest1Model)
    .command('import:questions', importQuestions)
    .command('import:examples', importExamples)
    .command('migrate', migrate)
    .listen(onServerMainBootstrap, registerBot)
    .listen(onAppExecute, (event, parser: MarkdownParser) => parser.load())
    .loadConfigFromEnv({ namingStrategy: 'same', prefix: 'app_', envFilePath: ['local.env'] })
    .setup(module => {
        const assets = findParentPath('dist/', __dirname);
        if (assets) {
            module.addListener(serveStaticListener(module, '/', join(assets, 'app/browser')));
        }
    })
    .run();
