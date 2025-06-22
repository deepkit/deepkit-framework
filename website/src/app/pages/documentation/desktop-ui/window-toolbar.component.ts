import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Toolbar</h2>

        <doc-code-frame>
            <div class="window-frame">
                <dui-window>
                    <dui-window-header>
                        Angular Desktop UI

                        <dui-window-toolbar>
                            <dui-button-group>
                                <dui-button textured icon="envelop"></dui-button>
                            </dui-button-group>

                            <dui-button-group float="sidebar">
                                <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                            icon="toggle_sidebar"></dui-button>
                            </dui-button-group>

                            <dui-button-group padding="none">
                                <dui-button textured>Cool</dui-button>
                                <dui-button [active]="true" textured>Right</dui-button>
                                <dui-button textured>Yes</dui-button>
                            </dui-button-group>

                            <dui-button-group>
                                <dui-input style="width: 80px;" textured round placeholder="What up?"></dui-input>
                            </dui-button-group>

                            <dui-input textured icon="search" placeholder="Search" round clearer
                                       style="margin-left: auto;"></dui-input>
                        </dui-window-toolbar>
                    </dui-window-header>

                    <dui-window-content [sidebarVisible]="sidebarVisible">
                        <dui-window-sidebar>
                            <dui-list>
                                <dui-list-title>Form controls</dui-list-title>
                                <dui-list-item value="button">Button</dui-list-item>
                                <dui-list-item value="button-group">Button Group</dui-list-item>
                            </dui-list>
                        </dui-window-sidebar>

                        Content
                    </dui-window-content>
                </dui-window>
            </div>
            <textarea codeHighlight="html">
            <dui-window>
                <dui-window-header>
                    Angular Desktop UI

                    <dui-window-toolbar>
                        <dui-button-group>
                            <dui-button textured icon="envelop"></dui-button>
                        </dui-button-group>

                        <dui-button-group float="sidebar">
                            <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                        icon="toggle_sidebar"></dui-button>
                        </dui-button-group>

                        <dui-button-group padding="none">
                            <dui-button textured>Cool</dui-button>
                            <dui-button [active]="true" textured>Right</dui-button>
                            <dui-button textured>Yes</dui-button>
                        </dui-button-group>

                        <dui-button-group>
                            <dui-input style="width: 80px;" textured round placeholder="What up?"></dui-input>
                        </dui-button-group>

                        <dui-input textured icon="search" placeholder="Search" round clearer
                                   style="margin-left: auto;"></dui-input>
                    </dui-window-toolbar>
                </dui-window-header>

                <dui-window-content [sidebarVisible]="sidebarVisible">
                    <dui-window-sidebar>
                        Sidebar
                    </dui-window-sidebar>

                    Content
                </dui-window-content>
            </dui-window>
            </textarea>
        </doc-code-frame>
    `,
    styleUrls: ['./window.scss'],
})
export class DocDesktopUIWindowToolbarComponent {
    sidebarVisible = true;
}
