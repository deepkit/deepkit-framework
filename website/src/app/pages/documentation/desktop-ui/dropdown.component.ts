import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/doc.module.js';
import { ButtonComponent, ButtonGroupComponent, DropdownComponent, OpenDropdownDirective, OpenDropdownHoverDirective } from '@deepkit/desktop-ui';

@Component({
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        ButtonComponent,
        ButtonGroupComponent,
        OpenDropdownDirective,
        DropdownComponent,
        ApiDocComponent,
        OpenDropdownHoverDirective,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Button group</h1>

        <doc-code-frame>
          <dui-button textured [openDropdown]="dropdown1">Toggle dropdown</dui-button>
          <dui-dropdown #dropdown1>
            <div style="padding: 5px 25px;">
              Hi there!
            </div>
          </dui-dropdown>

          <dui-button textured [openDropdownHover]="dropdown2">Hover dropdown</dui-button>
          <dui-dropdown #dropdown2>
            <div style="padding: 5px 25px;">
              Wow
            </div>
          </dui-dropdown>

          <p>
            <dui-button-group padding="none">
              <dui-button textured>Split button</dui-button>
              <dui-button textured tight icon="arrow_down" [openDropdown]="dropdown3"></dui-button>
            </dui-button-group>
            <dui-dropdown #dropdown3>
              <div style="padding: 5px 25px;">
                Hi there!
                <a (click)="dropdown3.close()">Close</a>
              </div>
            </dui-dropdown>
          </p>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>

        <api-doc module="components/button/dropdown.component" component="DropdownComponent"></api-doc>
      </div>
    `,
})
export class DocDesktopUIButtonDropdownComponent {
    code = `
  <dui-button textured [openDropdown]="dropdown1">Toggle dropdown</dui-button>
  <dui-dropdown #dropdown1>
    <div style="padding: 5px 25px;">
      Hi there!
    </div>
  </dui-dropdown>

  <dui-button textured [openDropdownHover]="dropdown2">Hover dropdown</dui-button>
  <dui-dropdown #dropdown2>
    <div style="padding: 5px 25px;">
      Wow
    </div>
  </dui-dropdown>

  <p>
    <dui-button-group padding="none">
      <dui-button textured>Split button</dui-button>
      <dui-button textured tight icon="arrow_down" [openDropdown]="dropdown3"></dui-button>
    </dui-button-group>
    <dui-dropdown #dropdown3>
      <div style="padding: 5px 25px;">
        Hi there!
        <a (click)="dropdown3.close()">Close</a>
      </div>
    </dui-dropdown>
  </p>
`;
}
