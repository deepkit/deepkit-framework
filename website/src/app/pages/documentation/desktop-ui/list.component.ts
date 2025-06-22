import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>List</h2>

        <textarea codeHighlight>
        import {DuiListModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div style="max-width: 350px;">
                <dui-list [(ngModel)]="selected">
                    <dui-list-title>Form controls</dui-list-title>
                    <dui-list-item value="button">Button</dui-list-item>
                    <dui-list-item value="button-group">Button Group</dui-list-item>

                    <dui-list-title>Window</dui-list-title>
                    <dui-list-item value="window">Window</dui-list-item>
                    <dui-list-item value="toolbar">Toolbar</dui-list-item>
                    <dui-list-item value="sidebar">Sidebar</dui-list-item>

                    <dui-list-title>Buttons & Indicators</dui-list-title>
                    <dui-list-item value="checkbox">Checkbox</dui-list-item>
                    <dui-list-item value="radiobox">Radiobox</dui-list-item>
                    <dui-list-item value="select">Select</dui-list-item>
                </dui-list>
                <p>
                    Selected dui-list-item: {{selected}}
                </p>
            </div>
            <textarea codeHighlight="html">
                <dui-list [(ngModel)]="selected">
                    <dui-list-title>Form controls</dui-list-title>
                    <dui-list-item value="button">Button</dui-list-item>
                    <dui-list-item value="button-group">Button Group</dui-list-item>

                    <dui-list-title>Window</dui-list-title>
                    <dui-list-item value="window">Window</dui-list-item>
                    <dui-list-item value="toolbar">Toolbar</dui-list-item>
                    <dui-list-item value="sidebar">Sidebar</dui-list-item>

                    <dui-list-title>Buttons & Indicators</dui-list-title>
                    <dui-list-item value="checkbox">Checkbox</dui-list-item>
                    <dui-list-item value="radiobox">Radiobox</dui-list-item>
                    <dui-list-item value="select">Select</dui-list-item>
                </dui-list>
                <p>
                    Selected dui-list-item: {{selected}}
                </p>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/list/list.component" component="ListComponent"></api-doc>

        <api-doc module="components/list/list.component" component="ListItemComponent"></api-doc>

        <api-doc module="components/list/list.component" component="ListTitleComponent"></api-doc>
    `
})
export class DocDesktopUIListComponent {
    sidebarVisible = true;
    selected = 'button';
}
