import { NgModule } from '@angular/core';
import { BenchmarksComponent } from './benchmarks.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PlotlyModule } from 'angular-plotly.js';
import { MarkdownModule } from 'ngx-markdown';

// @ts-ignore
import * as PlotlyJS from 'plotly.js-dist-min';
import { AppTitle } from "@app/app/components/title";
import { PerformanceChartComponent, PerformanceEntryDirective } from "@app/app/components/performance-chart.component";


PlotlyModule.plotlyjs = PlotlyJS;

const routes: Routes = [
    {path: '', component: BenchmarksComponent}
];

@NgModule({
    declarations: [
        BenchmarksComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        PlotlyModule,
        MarkdownModule.forRoot(),
        RouterModule.forChild(routes),
        AppTitle,
        PerformanceChartComponent,
        PerformanceEntryDirective,
    ]
})
export class BenchmarksModule {

}
