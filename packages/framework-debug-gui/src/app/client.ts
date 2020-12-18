import {Injectable} from '@angular/core';
import {DeepkitClient} from '@deepkit/framework-client';
import {Workflow, DebugControllerInterface, DebugRequest} from '@deepkit/framework-debug-shared';
import {Collection} from '@deepkit/framework-shared';

@Injectable()
export class ControllerClient {
  protected requests?: Promise<Collection<DebugRequest>>;
  protected workflows: { [name: string]: Promise<Workflow> } = {};

  constructor(protected client: DeepkitClient) {
  }

  public readonly debug = this.client.controller(DebugControllerInterface);


  public getWorkflow(name: string): Promise<Workflow> {
    if (this.workflows[name]) return this.workflows[name];
    return this.workflows[name] = this.debug.getWorkflow(name);
  }

  public getHttpRequests(): Promise<Collection<DebugRequest>> {
    if (this.requests) return this.requests;
    return this.requests = this.debug.httpRequests();
  }
}
