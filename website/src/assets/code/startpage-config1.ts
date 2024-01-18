export class AppConfig {
    pageTitle: string & MinLength<2> = 'Cool site';
    databaseUrl: string = 'mongodb://localhost/mydb';
    debug: boolean = false;
}

new App({
    config: AppConfig,
    providers: [DefaultDatabase],
}).loadConfigFromEnv().run();
