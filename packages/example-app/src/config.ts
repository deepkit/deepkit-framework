import { AppModuleConfig } from '@deepkit/app';
import { t } from '@deepkit/type';

export const config = new AppModuleConfig({
    dbPath: t.string.default('/tmp/myapp.sqlite'),
    environment: t.union('development', 'production').default('development').description(`
        In development we enable FrameworkModule debugger.
        In production we enable JSON logger.
    `)
});
