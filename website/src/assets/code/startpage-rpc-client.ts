// @app/client.ts
import {DeepkitClient} from '@deepkit/rpc';
import type {MyController} from '@app/server/controller';

const client = new DeepkitClient('localhost');
const myController = client.controller<MyController>('/main');
const user = await myController.getUser(42); //fully type-safe
