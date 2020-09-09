import {Component, OnInit} from '@angular/core';
import {SocketClient} from '@super-hornet/framework-client';

interface MyController {
  bla(): any;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'website';

  public controller = this.client.controller<MyController>('test');

  constructor(public client: SocketClient) {
  }

  async ngOnInit() {
    console.log('bla', await this.controller.bla());
  }
}
