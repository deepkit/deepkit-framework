import { App, findParentPath, onAppExecute } from '@deepkit/app';
import { FrameworkModule, onServerMainBootstrap } from '@deepkit/framework';
import { AppConfig } from './config';
import { MainController } from '@app/server/controller/main.controller';
import { AngularListener } from '@app/server/angular';
import { serveStaticListener } from '@deepkit/http';
import { join } from 'path';
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

(global as any).window = undefined;
(global as any).document = undefined;

const app = new App({
    config: AppConfig,
    controllers: [
        MainController,
        WebController,
        BenchmarkController,
        BenchmarkHttpController,
    ],
    listeners: [
        AngularListener,
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
            httpRpcBasePath: 'api/v1'
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
app.listen(onAppExecute, (event, parser: MarkdownParser) => parser.load());

app.loadConfigFromEnv({ namingStrategy: 'same', prefix: 'app_', envFilePath: ['local.env'] });

app.setup((module) => {
    const assets = findParentPath('dist/', __dirname);
    if (assets) {
        module.addListener(serveStaticListener(module, '/', join(assets, 'app/browser')));
    }
});

void app.run();
