import {Injectable} from '@angular/core';
import {DeepkitClient} from '@deepkit/framework-client';
import {DebugControllerInterface} from '@deepkit/framework-debug-shared';

@Injectable()
export class ControllerClient {
  public readonly client = new DeepkitClient('ws://' + location.host);

  public readonly debug = this.client.controller(DebugControllerInterface);
}
