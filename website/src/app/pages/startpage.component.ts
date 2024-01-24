import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HighlightCodeComponent } from '@app/app/components/highlight-code.component';
import { ImageComponent } from '@app/app/components/image.component';
import { AppImagesComponent } from '@app/app/components/images.component';
import { PerformanceChartComponent, PerformanceEntryDirective } from '@app/app/components/performance-chart.component';
import { AppDescription } from '@app/app/components/title';

@Component({
    standalone: true,
    templateUrl: './startpage.component.html',
    imports: [
        RouterLink,
        AppImagesComponent,
        ImageComponent,
        HighlightCodeComponent,
        AppDescription,
        PerformanceChartComponent,
        PerformanceEntryDirective,
    ],
    styleUrls: ['./startpage.component.scss'],
})
export class StartpageComponent {}
