import {createConfig} from '@deepkit/framework';
import {t} from '@deepkit/type';

export const config = createConfig({
    browserPath: t.string.description('The path to the built dist file for the browser (with all the assets), usually something like ../../dist/browser'),
    serverPath: t.string.description('The path to the built dist file for the server, usually something like ../../dist/server'),
    serverModuleName: t.string.default('AppServerModule').description('The exported server module name, usually AppServerModule'),
});
