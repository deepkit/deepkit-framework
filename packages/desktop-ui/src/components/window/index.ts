import { ModuleWithProviders, NgModule } from "@angular/core";
import { WindowContentComponent } from "./window-content.component";
import { WindowComponent, WindowFrameComponent } from "./window.component";
import { WindowFooterComponent } from "./window-footer.component";
import {
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent
} from "./window-header.component";
import { CommonModule } from "@angular/common";
import { WindowSidebarComponent } from "./window-sidebar.component";
import { DuiSplitterModule } from "../splitter";
import { DuiIconModule } from "../icon";
import { WindowRegistry } from "./window-state";

import {
    ExternalDialogDirective,
    ExternalDialogWrapperComponent,
    ExternalWindowComponent
} from "./external-window.component";
import { DuiExternalWindow } from "./external-window";
import { DuiCoreModule } from "../core";

export * from "./window.component";
export * from "./external-window";
export * from "./external-window.component";
export * from "./window-content.component";
export * from "./window-header.component";
export * from "./window-footer.component";
export * from "./window-menu";
export * from "./window-sidebar.component";

@NgModule({
    declarations: [
        WindowContentComponent,
        WindowComponent,
        WindowFrameComponent,
        WindowFooterComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        WindowToolbarContainerComponent,
        WindowSidebarComponent,
        ExternalWindowComponent,
        ExternalDialogWrapperComponent,
        ExternalDialogDirective,
    ],
    exports: [
        WindowContentComponent,
        WindowComponent,
        WindowFrameComponent,
        WindowFooterComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        WindowToolbarContainerComponent,
        WindowSidebarComponent,
        ExternalWindowComponent,
        ExternalDialogWrapperComponent,
        ExternalDialogDirective,
    ],
    entryComponents: [
        ExternalWindowComponent,
    ],
    providers: [
        DuiExternalWindow,
    ],
    imports: [
        CommonModule,
        DuiSplitterModule,
        DuiIconModule,
        DuiCoreModule,
    ]
})
export class DuiWindowModule {
    static forRoot(): ModuleWithProviders<DuiWindowModule> {
        return {
            ngModule: DuiWindowModule,
            providers: [WindowRegistry]
        }
    }
}
