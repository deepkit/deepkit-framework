import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ControllerClient} from '../../client';
import {Config} from '@deepkit/framework-debug-shared';

@Component({
  template: `
    <div class="section">
      <div class="header">
        <h4>Application configuration</h4>
        <dui-input placeholder="Filter" round semiTransparent lightFocus [(ngModel)]="applicationConfigFilter"></dui-input>
      </div>
      <p>
        Application config values from your root application module.
      </p>
      <dui-table [items]="filter(applicationConfig, applicationConfigFilter)" noFocusOutline>
        <dui-table-column class="text-selection" name="name"></dui-table-column>
        <dui-table-column class="text-selection" width="80%" name="value"></dui-table-column>
      </dui-table>
    </div>

    <div class="section">
      <div class="header">
        <h4>Custom configuration</h4>
        <dui-input placeholder="Filter" round semiTransparent lightFocus [(ngModel)]="configFilter"></dui-input>
      </div>
      <p>
        Config values from your <code>.env</code> file or manual setting via <code>Configuration</code> service.
      </p>
      <dui-table [items]="filter(config, configFilter)" noFocusOutline>
        <dui-table-column class="text-selection" name="name"></dui-table-column>
        <dui-table-column class="text-selection" width="80%" name="value"></dui-table-column>
      </dui-table>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      height: 100%;
    }

    .section {
      flex: 1 1 auto;
      height: 100%;
      display: flex;
      margin: 5px;
      flex-direction: column;
    }

    .header {
      display: flex;
    }

    .header dui-input {
      margin-left: auto;
    }

    .section h4 {
      margin-bottom: 10px;
    }

    dui-table {
      flex: 1;
    }
  `]
})
export class ConfigurationComponent implements OnInit {
  public applicationConfigFilter: string = '';
  public configFilter: string = '';

  public applicationConfig: { name: string, value: any }[] = [];
  public config: { name: string, value: any }[] = [];

  constructor(
    private controllerClient: ControllerClient,
    public cd: ChangeDetectorRef,
  ) {
  }

  filter(items: { name: string }[], filter: string): any[] {
    if (!filter) return items;

    return items.filter(v => v.name.includes(filter));
  }

  async ngOnInit(): Promise<void> {
    const configuration = await this.controllerClient.debug.configuration();
    this.applicationConfig = [];
    for (const [name, value] of Object.entries(configuration.applicationConfig)) {
      this.applicationConfig.push({name, value});
    }

    this.config = [];
    for (const [name, value] of Object.entries(configuration.configuration)) {
      this.config.push({name, value});
    }

    this.cd.detectChanges();
  }
}
