import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Icon</h2>

        <p>
            This library comes with own set of icons you can use in dui-button, dui-input and dui-icon. All icons are
            available as SVGs and are compiled to
            a font file you should import in your angular config. See the getting started page to know how to install
            the font correctly.
        </p>
        <doc-code-frame>
            <div>
                <dui-icon name="flag" [size]="8"></dui-icon>
                <dui-icon name="flag"></dui-icon>
                <dui-icon name="flag" [size]="24"></dui-icon>
                <p>
                    <dui-button icon="flag">My button</dui-button>
                    <dui-button icon="flag" iconRight>My Button</dui-button>
                    <dui-button icon="check">Check</dui-button>
                    <dui-button icon="star">Star</dui-button>
                </p>
                <p>
                    <dui-button icon="arrow_down">Dropdown</dui-button>
                    <dui-button icon="arrow_down" iconRight>Dropdown</dui-button>
                </p>
                <p>
                    <dui-button-group padding="none">
                        <dui-button icon="garbage"></dui-button>
                        <dui-button icon="flag"></dui-button>
                    </dui-button-group>
                    <dui-button-group padding="none">
                        <dui-button small [iconSize]="15" icon="garbage"></dui-button>
                        <dui-button small icon="flag"></dui-button>
                    </dui-button-group>
                </p>
                <p>
                    <dui-input round placeholder="My input with icon" icon="flag"></dui-input>
                </p>

                <p>
                    <dui-icon name="zoom-to-fit" clickable></dui-icon>
                    Clickable icon
                </p>

                <dui-button-groups>
                    <dui-button-group padding="none">
                        <dui-select textured [ngModel]="12" small style="width: 50px;">
                            <dui-option [value]="8">8</dui-option>
                            <dui-option [value]="12">12</dui-option>
                        </dui-select>
                    </dui-button-group>

                    <dui-button-group padding="none">
                        <dui-button textured small icon="15_text-format-bold"></dui-button>
                        <dui-button textured small [active]="true" icon="15_text-format-italic"></dui-button>
                        <dui-button textured small icon="15_text-format-underline"></dui-button>
                        <dui-button textured small icon="15_text-format-strikethrough"></dui-button>
                    </dui-button-group>

                    <dui-button-group padding="none">
                        <dui-button textured small [active]="true" icon="15_text-format-align-left"></dui-button>
                        <dui-button textured small icon="15_text-format-align-center"></dui-button>
                        <dui-button textured small icon="15_text-format-align-right"></dui-button>
                    </dui-button-group>
                </dui-button-groups>
            </div>
            <textarea codeHighlight="html">
<dui-icon name="flag" [size]="8"></dui-icon>
<dui-icon name="flag"></dui-icon>
<dui-icon name="flag" [size]="24"></dui-icon>
<p>
    <dui-button icon="flag">My button</dui-button>
    <dui-button icon="flag" iconRight>My Button</dui-button>
    <dui-button icon="check">Check</dui-button>
    <dui-button icon="star">Star</dui-button>
</p>
<p>
    <dui-button icon="arrow_down">Dropdown</dui-button>
    <dui-button icon="arrow_down" iconRight>Dropdown</dui-button>
</p>
<p>
    <dui-button-group padding="none">
        <dui-button icon="garbage"></dui-button>
        <dui-button icon="flag"></dui-button>
    </dui-button-group>
    <dui-button-group padding="none">
        <dui-button small [iconSize]="15" icon="garbage"></dui-button>
        <dui-button small icon="flag"></dui-button>
    </dui-button-group>
</p>
<p>
    <dui-input round placeholder="My input with icon" icon="flag"></dui-input>
</p>

<p>
    <dui-icon name="zoom-to-fit" clickable></dui-icon> Clickable icon
</p>

<dui-button-groups>
    <dui-button-group padding="none">
        <dui-select textured [ngModel]="12" small style="width: 50px;">
            <dui-option [value]="8">8</dui-option>
            <dui-option [value]="12">12</dui-option>
        </dui-select>
    </dui-button-group>

    <dui-button-group padding="none">
        <dui-button textured small icon="15_text-format-bold"></dui-button>
        <dui-button textured small [active]="true" icon="15_text-format-italic"></dui-button>
        <dui-button textured small icon="15_text-format-underline"></dui-button>
        <dui-button textured small icon="15_text-format-strikethrough"></dui-button>
    </dui-button-group>
    
    <dui-button-group padding="none">
        <dui-button textured small [active]="true" icon="15_text-format-align-left"></dui-button>
        <dui-button textured small icon="15_text-format-align-center"></dui-button>
        <dui-button textured small icon="15_text-format-align-right"></dui-button>
    </dui-button-group>
</dui-button-groups>
</textarea>
        </doc-code-frame>
        <api-doc module="components/icon/icon.component" component="IconComponent"></api-doc>

        <h3>Icons available</h3>

        These icons can be used right away.

        <p class="dui-theme-light">
            <icon-browser></icon-browser>
        </p>

        <h3>Add own icons</h3>

        <p>
            To add additional icons to the set above you need to define each icon as SVG and put it all in one folder.
            The name of the svg file will
            be the name of your icon.
        </p>

        The structure should look like that

        <textarea codeHighlight>
src/assets/icons
├── cluster.svg
├── dashboard.svg
├── dataset.svg
├── experiment_detail.svg
├── file.svg
├── logo.svg
├── plus.svg
├── projects.svg
└── settings.svg
└── 15_text-format-code.svg
</textarea>

        Note: All icons are per default 17x17 px. Some are 15x15 px, but dui-icon uses per default 17px. If you have different sized icons than 17x17 px
        you <strong>should</strong> strongly prefix those with the size. For example, our 15x15 px icons are named
        <code>15_text-format-bold</code>,
        <code>15_text-format-code</code> etc. Dui-icon automatically detects the size on that prefix. If you don't provide a prefix it uses 17px which only
        works correctly with 17x17 pixels, all other sizes will appear blurry. Optionally, you can specify on each dui-icon a
        <code>size</code> input, but
        that is not recommended since that requires you to constantly think about the actual size of the icon, instead of the icon telling you on what
        pixel raster it works best. So, long story short: Use a prefix if not 17x17 px.

        <h4>Generate font</h4>

        To generate then your custom icon font set, you simply have to call

        <textarea codeHighlight="bash">
node node_modules/@marcj/angular-desktop-ui/bin/create-font.js src/assets/icons
</textarea>

        You'll see a list of all base icons (from this library) and all your newly added icons.
        You can call this as often as you add new icons to your icon folder. Don't forget to git commit your svg files, so they don't get lost.

        The <code>create-font.js</code> file generates in
        <code>src/assets/fonts/</code> your new font files which you should import in your css:

        <textarea codeHighlight="css">
@font-face {
    font-family: 'Desktop UI icon Mono';
    src: url("./assets/fonts/ui-icons.svg") format('svg'), url("./assets/fonts/ui-icons.woff") format('woff'), url("./assets/fonts/ui-icons.ttf") format('ttf');
    font-weight: normal;
    font-style: normal;
}

.ui-icon {
    font-family: 'Desktop UI icon Mono' !important;
    font-weight: normal !important;
    font-style: normal !important;
    font-size: 17px;
    display: inline-block;
    line-height: 1;
    text-transform: none;
    letter-spacing: normal;
    word-wrap: normal;
    white-space: nowrap;
    direction: ltr;

    /* Support for all WebKit browsers. */
    -webkit-font-smoothing: antialiased;
    /* Support for Safari and Chrome. */
    text-rendering: optimizeLegibility;

    /* Support for Firefox. */
    -moz-osx-font-smoothing: grayscale;

    /* Support for IE. */
    font-feature-settings: 'liga';
}
</textarea>

    `
})
export class DocDesktopUIIconComponent {

}
