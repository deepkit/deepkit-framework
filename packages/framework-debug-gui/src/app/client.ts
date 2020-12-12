import {Injectable} from '@angular/core';
import {DeepkitClient} from '@deepkit/framework-client';
import {DebugControllerInterface} from '@deepkit/framework-debug-shared';

@Injectable()
export class ControllerClient {
  constructor(protected client: DeepkitClient) {
  }

  public readonly debug = this.client.controller(DebugControllerInterface);
}
