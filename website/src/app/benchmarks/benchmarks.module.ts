import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PerformanceChartComponent, PerformanceEntryDirective } from '@app/app/components/performance-chart.component';
import { AppTitle } from '@app/app/components/title';
import { PlotlyModule } from 'angular-plotly.js';
import { MarkdownModule } from 'ngx-markdown';
// @ts-ignore
import * as PlotlyJS from 'plotly.js-dist-min';

import { BenchmarksComponent } from './benchmarks.component';

PlotlyModule.plotlyjs = PlotlyJS;

const routes: Routes = [{ path: '', component: BenchmarksComponent }];

@NgModule({
    declarations: [BenchmarksComponent],
    imports: [
        CommonModule,
        FormsModule,
        PlotlyModule,
        MarkdownModule.forRoot(),
        RouterModule.forChild(routes),
        AppTitle,
        PerformanceChartComponent,
        PerformanceEntryDirective,
    ],
})
export class BenchmarksModule {}
