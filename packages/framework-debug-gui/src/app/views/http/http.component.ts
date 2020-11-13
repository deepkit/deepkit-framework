import {ChangeDetectorRef, Component} from '@angular/core';
import {ControllerClient} from '../../client';

@Component({
  template: `
    routes: path, method, parameters, controller/method,
    client

  `
})
export class HttpComponent {
  constructor(
    private controllerClient: ControllerClient,
    public cd: ChangeDetectorRef,
  ) {
  }
}
