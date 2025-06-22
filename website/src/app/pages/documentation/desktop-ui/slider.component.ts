import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Slider</h2>

        <textarea codeHighlight>
        import {DuiSliderModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div>
                <p>
                    <dui-slider [(ngModel)]="value"></dui-slider>
                    <br/>
                    Value: {{value}}
                </p>
                <p>
                    <dui-slider [min]="50" [max]="200" [(ngModel)]="value2"></dui-slider>
                    <br/>
                    Value2: {{value2}}
                </p>

                <p>
                    <dui-slider [min]="50" [steps]="25" [max]="200" [(ngModel)]="value3"></dui-slider>
                    <br/>
                    Value3: {{value3}}
                </p>

                <p>
                    <dui-slider mini></dui-slider>
                    <br/>
                </p>
            </div>
            <textarea codeHighlight="html">
                <p>
                    <dui-slider [(ngModel)]="value"></dui-slider>
                    <br/>
                    Value: {{value}}
                </p>
                <p>
                    <dui-slider [min]="50" [max]="200" [(ngModel)]="value2"></dui-slider>
                    <br/>
                    Value2: {{value2}}
                </p>

                <p>
                    <dui-slider [min]="50" [steps]="25" [max]="200" [(ngModel)]="value3"></dui-slider>
                    <br/>
                    Value3: {{value3}}
                </p>

                <p>
                    <dui-slider mini></dui-slider>
                    <br/>
                </p>
            </textarea>
        </doc-code-frame>
        
    `
})
export class DocDesktopUISliderComponent {
    value = 0.30;
    value2 = 60;
    value3 = 75;
}
