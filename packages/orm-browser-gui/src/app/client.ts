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
import { BrowserControllerInterface } from '@deepkit/orm-browser-api';

@Injectable()
export class ControllerClient {

  public browser = this.client.controller(BrowserControllerInterface);

  constructor(protected client: DeepkitClient) {
  }

  static getServerHost(): string {
      return (location.port === '4200' ? location.hostname + ':9090' : location.host);
  }
}
