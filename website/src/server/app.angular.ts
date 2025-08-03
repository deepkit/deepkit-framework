import { AngularModule, RequestHandler } from '@deepkit/angular-ssr';
import { app } from './app';

app.appModule.addImport(new AngularModule({
    moduleUrl: import.meta.url,
    serverBaseUrl: 'http://localhost:8080',
}));

app.setup((module, config) => {
    if (config.baseUrl) {
        module.getImportedModuleByClass(AngularModule).configure({ publicBaseUrl: config.baseUrl });
    }
});

const isBuild = process.env.BUILD === 'angular'; //detecting prerender

export const reqHandler =
    isBuild
        ? () => undefined
        : app.get(RequestHandler).create();
