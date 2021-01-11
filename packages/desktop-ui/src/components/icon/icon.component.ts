import { Component, HostBinding, Input, OnChanges, OnInit } from '@angular/core';

@Component({
    selector: 'dui-icon',
    template: `{{name}}`,
    host: {
        '[class.ui-icon]': 'true',
        '[style.fontSize.px]': 'usedSize',
        '[style.height.px]': 'usedSize',
        '[style.width.px]': 'usedSize',
        '[style.color]': 'color',
    },
    styles: [`
        :host {
            display: inline-block;
            vertical-align: middle;
            text-align: center;
            font-size: 17px;
            height: 17px;
            width: 17px;
        }

        :host:focus {
            outline: 0;
        }

        :host.disabled {
            opacity: 0.6;
        }

        :host.clickable:hover {
            opacity: 0.7;
        }

        :host.clickable:active {
            color: var(--dui-selection);
        }
    `]
})
export class IconComponent implements OnInit, OnChanges {
    /**
     * The icon for this button. Either a icon name same as for dui-icon, or an image path.
     */
    @Input() name?: string;

    /**
     * Change in the icon size. Should not be necessary usually.
     */
    @Input() size?: number;

    @Input() clickable: boolean | '' = false;

    @Input() color?: string;

    public usedSize = 17;

    @HostBinding('class.clickable')
    get isClickable() {
        return false !== this.clickable;
    }

    @Input() disabled: boolean = false;
    @HostBinding('class.disabled')
    get isDisabled() {
        return false !== this.disabled;
    }

    constructor() {
    }

    ngOnChanges(): void {
        if (this.size) {
            this.usedSize = this.size;
        }

        if (!this.size && this.name) {
            const pos = this.name.indexOf('_');
            if (pos !== -1) {
                const potentialNumber = parseInt(this.name.slice(0, pos), 10);
                if (potentialNumber) {
                    this.usedSize = potentialNumber;
                }
            }
        }
    }


    ngOnInit() {
    }
}
