import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-image',
    standalone: true,
    template: `
        <a target="_blank" href="{{src}}">
            <img alt="{{alt || altFromSrc}}" src="{{src}}"/>
        </a>
    `,
    styles: [`
        :host {
            display: flex;
            max-width: 100%;
            text-align: center;
        }

        img {
            height: 100%;
            object-fit: contain;
        }
    `]
})
export class ImageComponent {
    @Input() src!: string;
    @Input() alt?: string;

    get altFromSrc(): string {
        let name = this.src.substr(this.src.lastIndexOf('.'));
        name = name.substr(name.lastIndexOf('/'));
        return name;
    }
}
