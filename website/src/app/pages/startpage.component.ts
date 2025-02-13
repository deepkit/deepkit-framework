import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImageComponent } from '@app/app/components/image.component';
import { HighlightCodeComponent } from '@app/app/components/highlight-code.component';
import { AppImagesComponent } from '@app/app/components/images.component';
import { AppDescription } from '@app/app/components/title';
import { PerformanceChartComponent, PerformanceEntryDirective } from '@app/app/components/performance-chart.component';

@Component({
    templateUrl: './startpage.component.html',
    imports: [
        RouterLink,
        AppImagesComponent,
        ImageComponent,
        HighlightCodeComponent,
        AppDescription,
        PerformanceChartComponent,
        PerformanceEntryDirective
    ],
    styleUrls: ['./startpage.component.css']
})
export class StartpageComponent {
}
