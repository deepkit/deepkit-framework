import { App } from '@deepkit/app';
import { FrameworkModule, onServerMainBootstrap, serveFilesystem } from '@deepkit/framework';
import { AppConfig } from './config';
import { MainController } from '@app/server/controller/main.controller';
import { Search } from '@app/server/search';
import { OpenAI } from 'openai';
import { fineTuneTest1, fineTuneTest1Check, fineTuneTest1Model, mlGenAnswerCommand, mlGenQuestionCommand } from '@app/server/commands/ml-fine-tuning';
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
import { AdminController } from '@app/server/controller/admin.controller';
import { RpcKernelSecurity, SessionState } from '@deepkit/rpc';
import { AppRpcKernelSecurity, AppSession } from '@app/server/rpc';
import { UserAuthentication } from '@app/server/user-authentication';
import { AdminFilesController } from '@app/server/controller/admin-files.controller';
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemDatabaseAdapter } from '@deepkit/filesystem-database';
import { translateCommand } from '@app/server/commands/translate';

(global as any).window = undefined;
(global as any).document = undefined;

function createFilesystem(database: Database) {
    return new Filesystem(new FilesystemDatabaseAdapter({ database }), {
        baseUrl: '/media',
    });
}

export const app = new App({
    config: AppConfig,
    controllers: [
        AdminController,
        AdminFilesController,
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
        UserAuthentication,
        { provide: Database, useClass: MainDatabase },
        { provide: Filesystem, useFactory: createFilesystem },
        { provide: RpcKernelSecurity, scope: 'rpc', useClass: AppRpcKernelSecurity },
        {
            provide: AppSession, scope: 'rpc', useFactory: (sessionState: SessionState) => {
                const session = sessionState.getSession();
                if (session instanceof AppSession) return session;
                throw new Error('Not authenticated');
            },
        },
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
        }),
    ],
});

app.setup((module, config) => {
    serveFilesystem<Filesystem>(module, { baseUrl: 'media/' });
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

app.command('translate', translateCommand);

app.listen(onServerMainBootstrap, registerBot);
app.listen(onServerMainBootstrap, (event, parser: MarkdownParser) => parser.load());

app.loadConfigFromEnv({ namingStrategy: 'upper', prefix: 'APP_', envFilePath: ['local.env'] });

// app.configureProvider<Logger>(logger => {
//     logger.setLevel('debug');
// });

if ('undefined' !== typeof module && require.main === module) {
    void app.run();
}
