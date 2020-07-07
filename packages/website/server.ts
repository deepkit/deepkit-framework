import 'zone.js/dist/zone-node';
import "reflect-metadata";

import {ngExpressEngine} from '@nguniversal/express-engine';
import * as express from 'express';
import {join} from 'path';

const {createProxyMiddleware} = require('http-proxy-middleware');

import {AppServerModule} from './src/main.server';
import {APP_BASE_HREF} from '@angular/common';
import {existsSync} from 'fs';
import {Application, ApplicationServer, ApplicationServerConfig} from '@super-hornet/framework-server';
import {Action, Controller} from "@super-hornet/framework-shared";
import * as http from "http";
import {createServer} from "net";
import {createServer as createHttpServer} from "http";
import {format} from "url";
import {environment} from "./src/environments/environment";

(global as any).WebSocket = require('ws');

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/website/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html')) ? 'index.original.html' : 'index';

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule,
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    res.render(indexHtml, {req, providers: [{provide: APP_BASE_HREF, useValue: req.baseUrl}]});
  });

  return server;
}

async function run() {
  const port = parseInt(process.env.PORT || '0', 10) || 4000;

  // Start up the Node server
  const server = app();

  const http = server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });

  @Controller('test')
  class MyController {
    @Action()
    bla() {
      return 'YES!';
    }
  }

  class MyApplication extends Application {
  }

  const config: Partial<ApplicationServerConfig> = {
      path: '/api'
  };
  if (environment.production) {
    config.server = http;
  } else {
    config.port = 5200;
  }

  const superHornet = new ApplicationServer(MyApplication, config, [], [], [MyController]);

  superHornet.start();
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from './src/main.server';
