import { createConfig } from '@deepkit/injector';
import { t } from '@deepkit/type';

export const config = createConfig({
    debug: t.boolean.default(false)
});
