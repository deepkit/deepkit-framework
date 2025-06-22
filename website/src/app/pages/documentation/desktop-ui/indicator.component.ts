import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Indicator</h2>

        <textarea codeHighlight>
        import {DuiIndicatorModule} from '@deepkit/desktop-ui';
        </textarea>

        <dui-indicator [step]="progress"></dui-indicator> {{progress}}<br/>
        <dui-indicator [step]="0.2"></dui-indicator><br/>
        <dui-indicator [step]="1"></dui-indicator><br/>
        <dui-indicator [step]="0"></dui-indicator><br/>

        <p>
            <dui-slider [(ngModel)]="progress"></dui-slider>
        </p>

        <api-doc module="components/indicator/indicator.component" component="IndicatorComponent"></api-doc>
    `
})
export class DocDesktopUIIndicatorComponent {
    progress = 0.5;
}
