import { AfterViewInit, ChangeDetectorRef, Component, ContentChildren, QueryList } from '@angular/core';
import { ImageComponent } from './image.component';
import { NgForOf, NgIf } from "@angular/common";

@Component({
    selector: 'app-images',
    standalone: true,
    template: `
        <ng-container *ngIf="images">
            <div class="image" *ngIf="selected">
                <app-image style="height: 100%" [alt]="selected.alt" [src]="selected.src"></app-image>
            </div>

            <div class="thumbnails">
                <div [class.selected]="image === selected" *ngFor="let image of images.toArray()">
                    <img src="{{image.src}}" alt="{{image.alt}}" (click)="select(image)">
                </div>
            </div>
        </ng-container>
    `,
    imports: [
        NgIf,
        ImageComponent,
        NgForOf
    ],
    styles: [`
        :host {
            display: block;
            margin: 25px auto;
        }

        .image {
            height: 700px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .actions span {
            display: inline-block;
            padding: 5px;
            margin: 0 2px;
            font-size: 22px;
        }

        .actions span:hover {
            opacity: 0.4;
            cursor: pointer;
        }

        .actions span.selected {
            color: var(--color-orange);
        }

        .thumbnails {
            display: flex;
            flex-wrap: nowrap;
            justify-content: center;
            margin-top: 20px;

            > div {
                cursor: pointer;
                display: flex;
                align-items: center;
                border: 1px solid transparent;
                border-radius: 5px;
                overflow: hidden;
                padding: 0 15px;
                width: 250px;
                height: 200px;

                &.selected {
                    border: 1px solid var(--color-orange);
                }

                img {
                    width: 250px;
                    height: 200px;
                    object-fit: contain;
                    max-width: 100%;
                }
            }
        }
    `]
})
export class AppImagesComponent implements AfterViewInit {
    @ContentChildren(ImageComponent, {descendants: true}) images?: QueryList<ImageComponent>;

    selected?: ImageComponent;

    constructor(protected cd: ChangeDetectorRef) {
    }

    ngAfterViewInit(): void {
        this.selected = this.images?.toArray()[0];
        this.cd.detectChanges();
    }

    select(image: ImageComponent) {
        this.selected = image;
        this.cd.detectChanges();
    }
}
