// @app/client.ts
import type { MyController } from '@app/server/controller';

import { DeepkitClient } from '@deepkit/rpc';

const client = new DeepkitClient('localhost');
const myController = client.controller<MyController>('/main');
const user = await myController.getUser(42); //fully type-safe
