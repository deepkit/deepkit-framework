import {Injectable} from '@angular/core';
import {DeepkitClient} from '@deepkit/framework-client';
import {DebugControllerSymbol} from '@deepkit/framework-debug-shared';

@Injectable()
export class ControllerClient {
  public readonly client = new DeepkitClient('ws://localhost:8080');

  public readonly debug = this.client.controller(DebugControllerSymbol);
}
