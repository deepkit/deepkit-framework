import { Component, signal } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';
import { TabComponent, TabsComponent } from '@deepkit/desktop-ui';
import { AppTitle } from '@app/app/components/title.js';

@Component({
    host: { ngSkipHydration: 'true' },
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        ApiDocComponent,
        TabsComponent,
        TabComponent,
        AppTitle,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Tabs</h1>
        <app-title value="Tabs"></app-title>


        <doc-code-frame>
          <dui-tabs>
            <dui-tab (click)="activeTab.set(0)" [active]="activeTab() === 0" [removable]="true">Tab A</dui-tab>
            <dui-tab (click)="activeTab.set(1)" [active]="activeTab() === 1" [removable]="true">Tab B</dui-tab>
            <dui-tab (click)="activeTab.set(2)" [active]="activeTab() === 2" [removable]="true">Tab C</dui-tab>
          </dui-tabs>
          <div class="content">
            Tab={{ activeTab() }}
          </div>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>

        <api-doc component="TabsComponent"></api-doc>
        <api-doc component="TabComponent"></api-doc>
      </div>
    `,
    styles: `
        .content {
            padding: 25px;
        }
    `,
})
export class DocDesktopUITabsComponent {
    activeTab = signal(0);

    code = `
      <dui-tabs>
        <dui-tab (click)="activeTab.set(0)" [active]="activeTab() === 0" [removable]="true">Tab A</dui-tab>
        <dui-tab (click)="activeTab.set(1)" [active]="activeTab() === 1" [removable]="true">Tab B</dui-tab>
        <dui-tab (click)="activeTab.set(2)" [active]="activeTab() === 2" [removable]="true">Tab C</dui-tab>
      </dui-tabs>
      <div class="content">
        Tab={{ activeTab() }}
      </div>
    `;
}
