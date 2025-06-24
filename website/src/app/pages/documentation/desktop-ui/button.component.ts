import { Component } from '@angular/core';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/doc.module.js';
import { CodeHighlightComponent, ThemeSwitcherComponent } from '@deepkit/ui-library';
import {
    ButtonComponent,
    CheckboxComponent,
    DropdownComponent,
    DropdownItemComponent,
    DropdownSplitterComponent,
    OpenDropdownDirective,
} from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-desktop-ui-button',
    imports: [
        CodeFrameComponent,
        CodeHighlightComponent,
        ButtonComponent,
        CheckboxComponent,
        DropdownComponent,
        DropdownItemComponent,
        DropdownSplitterComponent,
        ApiDocComponent,
        FormsModule,
        OpenDropdownDirective,
    ],
    host: {ngSkipHydration: 'true'},
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Button</h1>

        <doc-code-frame>
          <div>
            <p>
              <dui-button [disabled]="disabled">Default Button</dui-button>
            </p>

            <p>
              <dui-button [active]="true" [disabled]="disabled">Active Button</dui-button>
            </p>

            <p>
              <dui-button textured [disabled]="disabled">Textured button</dui-button>
            </p>

            <p>
              <dui-button square [disabled]="disabled">Square button</dui-button>
              <br />
            </p>

            <p>
              <dui-button square [disabled]="disabled" icon="add"></dui-button>
            </p>

            <p>
              <dui-button textured [disabled]="disabled" [openDropdown]="dropdown1" icon="arrow_down" iconRight>
                Dropdown
              </dui-button>
              <dui-dropdown #dropdown1>
                <div style="padding: 5px 25px;">
                  Hi there!
                </div>
              </dui-dropdown>
            </p>

            <p>
              <dui-button textured [disabled]="disabled" [openDropdown]="dropdown2" icon="arrow_down" iconRight>
                Dropdown items
              </dui-button>
              <dui-dropdown #dropdown2>
                <dui-dropdown-item>Flag A</dui-dropdown-item>
                <dui-dropdown-item [selected]="true">Flag B</dui-dropdown-item>
                <dui-dropdown-item>Flag C</dui-dropdown-item>
                <dui-dropdown-splitter></dui-dropdown-splitter>
                <dui-dropdown-item>Reset</dui-dropdown-item>
              </dui-dropdown>
            </p>

            <dui-checkbox [(ngModel)]="disabled">Disable all</dui-checkbox>
          </div>
          <code-highlight lang="html" [code]="code"/>
        </doc-code-frame>

        <api-doc module="components/button/button.component" component="ButtonComponent"></api-doc>
      </div>
    `,
})
export class DocDesktopUIButtonComponent {
    disabled = false;

    code = `
    <p>
        <dui-button [disabled]="disabled">Default Button</dui-button>
    </p>
    
    <p>
        <dui-button [active]="true" [disabled]="disabled">Active Button</dui-button>
    </p>
    
    <p>
        <dui-button textured [disabled]="disabled">Textured button</dui-button>
    </p>
    
    <p>
        <dui-button square [disabled]="disabled">Square button</dui-button>
        <br/>
    </p>
    
    <p>
        <dui-button square [disabled]="disabled" icon="add"></dui-button>
    </p>
    
    <p>
        <dui-button textured [disabled]="disabled" [openDropdown]="dropdown1" icon="arrow_down" iconRight>
            Dropdown
        </dui-button>
        <dui-dropdown #dropdown1>
            <div style="padding: 5px 25px;">
                Hi there!
            </div>
        </dui-dropdown>
    </p>
    
    <p>
        <dui-button textured [disabled]="disabled" [openDropdown]="dropdown2" icon="arrow_down" iconRight>
            Dropdown items
        </dui-button>
        <dui-dropdown #dropdown2>
            <dui-dropdown-item>Flag A</dui-dropdown-item>
            <dui-dropdown-item [selected]="true">Flag B</dui-dropdown-item>
            <dui-dropdown-item>Flag C</dui-dropdown-item>
            <dui-dropdown-splitter></dui-dropdown-splitter>
            <dui-dropdown-item>Reset</dui-dropdown-item>
        </dui-dropdown>
    </p>
    
    <dui-checkbox [(ngModel)]="disabled">Disable all</dui-checkbox>
`
}
