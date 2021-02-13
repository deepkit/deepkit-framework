/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Injectable } from '@angular/core';
import { DeepkitClient } from '@deepkit/rpc';
import { Workflow, DebugControllerInterface, DebugRequest } from '@deepkit/framework-debug-api';
import { Collection } from '@deepkit/rpc';

@Injectable()
export class ControllerClient {
  protected requests?: Promise<Collection<DebugRequest>>;
  protected workflows: { [name: string]: Promise<Workflow> } = {};

  constructor(protected client: DeepkitClient) {
  }

  public readonly debug = this.client.controller(DebugControllerInterface);

  static getServerHost(): string {
    return (location.port === '4200' ? location.hostname + ':8080' : location.host);
  }

  public getWorkflow(name: string): Promise<Workflow> {
    if (this.workflows[name]) return this.workflows[name];
    return this.workflows[name] = this.debug.getWorkflow(name);
  }

  public getHttpRequests(): Promise<Collection<DebugRequest>> {
    if (this.requests) return this.requests;
    return this.requests = this.debug.httpRequests();
  }
}
