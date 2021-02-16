import { t } from '@deepkit/type';
import { AppModuleConfig } from '@deepkit/app';

export const config = new AppModuleConfig({
    debug: t.boolean.default(false)
});
