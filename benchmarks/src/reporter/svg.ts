/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import type { BenchResult, BenchSuiteResult } from '@deepkit/bench';
import { formatHz } from '@deepkit/bench';

import { BenchmarkReport } from './json';

/**
 * SVG color palette
 */
const COLORS = {
    deepkit: '#4CAF50', // Green for Deepkit
    competitor: '#9E9E9E', // Gray for competitors
    background: '#ffffff',
    text: '#333333',
    textLight: '#666666',
    gridLine: '#e0e0e0',
    improvement: '#4CAF50',
    regression: '#F44336',
    neutral: '#2196F3',
};

/**
 * Options for bar chart generation
 */
export interface BarChartOptions {
    /** Width of the SVG */
    width?: number;
    /** Height per bar */
    barHeight?: number;
    /** Padding between bars */
    barPadding?: number;
    /** Left margin for labels */
    labelWidth?: number;
    /** Right margin for values */
    valueWidth?: number;
    /** Top/bottom padding */
    padding?: number;
    /** Title of the chart */
    title?: string;
    /** Font family */
    fontFamily?: string;
    /** Pattern to identify Deepkit benchmarks */
    deepkitPattern?: RegExp;
    /** Group spacing */
    groupPadding?: number;
}

/**
 * Options for comparison chart generation
 */
export interface ComparisonChartOptions extends BarChartOptions {
    /** Threshold for significant change (percentage) */
    threshold?: number;
}

/**
 * Escapes special XML characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Formats a number for display in SVG
 */
function formatNumber(value: number): string {
    if (value >= 1_000_000) {
        return (value / 1_000_000).toFixed(2) + 'M';
    } else if (value >= 1_000) {
        return (value / 1_000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
}

/**
 * Generates SVG style definitions
 */
function generateStyles(fontFamily: string): string {
    return `
    <style>
        .title { font: bold 16px ${fontFamily}; fill: ${COLORS.text}; }
        .subtitle { font: 12px ${fontFamily}; fill: ${COLORS.textLight}; }
        .label { font: 12px ${fontFamily}; fill: ${COLORS.text}; }
        .value { font: bold 11px ${fontFamily}; fill: ${COLORS.text}; }
        .axis-label { font: 10px ${fontFamily}; fill: ${COLORS.textLight}; }
        .group-title { font: bold 13px ${fontFamily}; fill: ${COLORS.text}; }
        .bar-deepkit { fill: ${COLORS.deepkit}; }
        .bar-competitor { fill: ${COLORS.competitor}; }
        .bar-improvement { fill: ${COLORS.improvement}; }
        .bar-regression { fill: ${COLORS.regression}; }
        .bar-neutral { fill: ${COLORS.neutral}; }
        .grid-line { stroke: ${COLORS.gridLine}; stroke-width: 1; }
    </style>`;
}

/**
 * Generates a horizontal bar chart SVG for benchmark results
 *
 * @param results - Benchmark results grouped by suite name
 * @param options - Chart options
 */
export function generateBarChart(
    results: { [suiteName: string]: BenchSuiteResult },
    options: BarChartOptions = {},
): string {
    const opts: Required<BarChartOptions> = {
        width: options.width ?? 800,
        barHeight: options.barHeight ?? 24,
        barPadding: options.barPadding ?? 8,
        labelWidth: options.labelWidth ?? 250,
        valueWidth: options.valueWidth ?? 120,
        padding: options.padding ?? 20,
        title: options.title ?? 'Benchmark Results',
        fontFamily: options.fontFamily ?? 'system-ui, -apple-system, sans-serif',
        deepkitPattern: options.deepkitPattern ?? /deepkit|@deepkit/i,
        groupPadding: options.groupPadding ?? 30,
    };

    // Collect all entries across suites
    const allEntries: Array<{
        suiteName: string;
        name: string;
        hz: number;
        isDeepkit: boolean;
    }> = [];

    for (const [suiteName, suiteResults] of Object.entries(results)) {
        for (const [name, result] of Object.entries(suiteResults)) {
            allEntries.push({
                suiteName,
                name,
                hz: result.hz,
                isDeepkit: opts.deepkitPattern.test(name),
            });
        }
    }

    // Group by suite
    const suiteGroups = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
        if (!suiteGroups.has(entry.suiteName)) {
            suiteGroups.set(entry.suiteName, []);
        }
        suiteGroups.get(entry.suiteName)!.push(entry);
    }

    // Sort each group by hz (descending)
    for (const entries of suiteGroups.values()) {
        entries.sort((a, b) => b.hz - a.hz);
    }

    // Calculate dimensions
    const numSuites = suiteGroups.size;
    const totalBars = allEntries.length;
    const groupTitleHeight = 25;
    const titleHeight = 50;

    const chartHeight =
        titleHeight +
        totalBars * (opts.barHeight + opts.barPadding) +
        numSuites * (opts.groupPadding + groupTitleHeight) +
        opts.padding * 2;

    const chartWidth = opts.width;
    const barAreaWidth = chartWidth - opts.labelWidth - opts.valueWidth - opts.padding * 2;

    // Find max value for scaling
    const maxHz = Math.max(...allEntries.map(e => e.hz));

    // Generate SVG elements
    const elements: string[] = [];

    // Background
    elements.push(`<rect width="${chartWidth}" height="${chartHeight}" fill="${COLORS.background}"/>`);

    // Styles
    elements.push(generateStyles(opts.fontFamily));

    // Title
    elements.push(`<text x="${opts.padding}" y="${opts.padding + 20}" class="title">${escapeXml(opts.title)}</text>`);

    // Grid lines
    const gridX = opts.padding + opts.labelWidth;
    const gridWidth = barAreaWidth;
    const numGridLines = 5;

    for (let i = 0; i <= numGridLines; i++) {
        const x = gridX + (gridWidth / numGridLines) * i;
        const value = (maxHz / numGridLines) * i;
        elements.push(
            `<line x1="${x}" y1="${titleHeight}" x2="${x}" y2="${chartHeight - opts.padding}" class="grid-line"/>`,
        );
        elements.push(
            `<text x="${x}" y="${titleHeight - 5}" class="axis-label" text-anchor="middle">${formatNumber(value)}</text>`,
        );
    }

    // Bars
    let currentY = titleHeight + opts.padding;

    for (const [suiteName, entries] of suiteGroups) {
        // Suite title
        elements.push(
            `<text x="${opts.padding}" y="${currentY + 15}" class="group-title">${escapeXml(suiteName)}</text>`,
        );
        currentY += groupTitleHeight;

        const suiteMax = Math.max(...entries.map(e => e.hz));

        for (const entry of entries) {
            const barWidth = (entry.hz / maxHz) * barAreaWidth;
            const barClass = entry.isDeepkit ? 'bar-deepkit' : 'bar-competitor';
            const factor = suiteMax / entry.hz;
            const factorText = factor === 1 ? 'fastest' : `x${factor.toFixed(2)}`;

            // Label
            elements.push(
                `<text x="${opts.padding + opts.labelWidth - 10}" y="${currentY + opts.barHeight / 2 + 4}" class="label" text-anchor="end">${escapeXml(entry.name)}</text>`,
            );

            // Bar
            elements.push(
                `<rect x="${gridX}" y="${currentY}" width="${barWidth}" height="${opts.barHeight}" class="${barClass}" rx="2"/>`,
            );

            // Value
            elements.push(
                `<text x="${gridX + barWidth + 5}" y="${currentY + opts.barHeight / 2 + 4}" class="value">${formatNumber(entry.hz)} ops/s (${factorText})</text>`,
            );

            currentY += opts.barHeight + opts.barPadding;
        }

        currentY += opts.groupPadding;
    }

    // Legend
    const legendY = titleHeight + 10;
    const legendX = chartWidth - opts.padding - 200;

    elements.push(`<rect x="${legendX}" y="${legendY}" width="12" height="12" class="bar-deepkit"/>`);
    elements.push(`<text x="${legendX + 18}" y="${legendY + 10}" class="label">Deepkit</text>`);
    elements.push(`<rect x="${legendX + 80}" y="${legendY}" width="12" height="12" class="bar-competitor"/>`);
    elements.push(`<text x="${legendX + 98}" y="${legendY + 10}" class="label">Other</text>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">
${elements.join('\n')}
</svg>`;
}

/**
 * Generates a comparison chart showing changes between baseline and current results
 *
 * @param current - Current benchmark results
 * @param baseline - Baseline benchmark results
 * @param options - Chart options
 */
export function generateComparisonChart(
    current: { [suiteName: string]: BenchSuiteResult },
    baseline: { [suiteName: string]: BenchSuiteResult },
    options: ComparisonChartOptions = {},
): string {
    const opts: Required<ComparisonChartOptions> = {
        width: options.width ?? 800,
        barHeight: options.barHeight ?? 24,
        barPadding: options.barPadding ?? 8,
        labelWidth: options.labelWidth ?? 250,
        valueWidth: options.valueWidth ?? 150,
        padding: options.padding ?? 20,
        title: options.title ?? 'Performance Comparison',
        fontFamily: options.fontFamily ?? 'system-ui, -apple-system, sans-serif',
        deepkitPattern: options.deepkitPattern ?? /deepkit|@deepkit/i,
        groupPadding: options.groupPadding ?? 30,
        threshold: options.threshold ?? 5,
    };

    // Collect comparison data
    const comparisons: Array<{
        suiteName: string;
        name: string;
        baselineHz: number;
        currentHz: number;
        changePercent: number;
        isImprovement: boolean;
        isRegression: boolean;
    }> = [];

    for (const [suiteName, currentResults] of Object.entries(current)) {
        const baselineResults = baseline[suiteName];
        if (!baselineResults) continue;

        for (const [name, currentResult] of Object.entries(currentResults)) {
            const baselineResult = baselineResults[name];
            if (!baselineResult) continue;

            const changePercent = ((currentResult.hz - baselineResult.hz) / baselineResult.hz) * 100;

            comparisons.push({
                suiteName,
                name,
                baselineHz: baselineResult.hz,
                currentHz: currentResult.hz,
                changePercent,
                isImprovement: changePercent > opts.threshold,
                isRegression: changePercent < -opts.threshold,
            });
        }
    }

    // Sort by change (regressions first, then improvements)
    comparisons.sort((a, b) => a.changePercent - b.changePercent);

    // Calculate dimensions
    const titleHeight = 50;
    const chartHeight = titleHeight + comparisons.length * (opts.barHeight + opts.barPadding) + opts.padding * 2;

    const chartWidth = opts.width;
    const barAreaWidth = (chartWidth - opts.labelWidth - opts.valueWidth - opts.padding * 2) / 2;
    const centerX = opts.padding + opts.labelWidth + barAreaWidth;

    // Find max absolute change for scaling
    const maxAbsChange = Math.max(...comparisons.map(c => Math.abs(c.changePercent)), 50);

    // Generate SVG elements
    const elements: string[] = [];

    // Background
    elements.push(`<rect width="${chartWidth}" height="${chartHeight}" fill="${COLORS.background}"/>`);

    // Styles
    elements.push(generateStyles(opts.fontFamily));

    // Title
    elements.push(`<text x="${opts.padding}" y="${opts.padding + 20}" class="title">${escapeXml(opts.title)}</text>`);

    // Center line
    elements.push(
        `<line x1="${centerX}" y1="${titleHeight}" x2="${centerX}" y2="${chartHeight - opts.padding}" stroke="${COLORS.text}" stroke-width="2"/>`,
    );

    // Grid lines and labels
    const gridIntervals = [-50, -25, 0, 25, 50];
    for (const pct of gridIntervals) {
        if (Math.abs(pct) > maxAbsChange && pct !== 0) continue;

        const x = centerX + (pct / maxAbsChange) * barAreaWidth;
        if (pct !== 0) {
            elements.push(
                `<line x1="${x}" y1="${titleHeight}" x2="${x}" y2="${chartHeight - opts.padding}" class="grid-line" stroke-dasharray="4"/>`,
            );
        }
        const label = pct >= 0 ? `+${pct}%` : `${pct}%`;
        elements.push(`<text x="${x}" y="${titleHeight - 5}" class="axis-label" text-anchor="middle">${label}</text>`);
    }

    // Axis labels
    elements.push(
        `<text x="${centerX - barAreaWidth / 2}" y="${titleHeight - 20}" class="subtitle" text-anchor="middle">Slower</text>`,
    );
    elements.push(
        `<text x="${centerX + barAreaWidth / 2}" y="${titleHeight - 20}" class="subtitle" text-anchor="middle">Faster</text>`,
    );

    // Bars
    let currentY = titleHeight + opts.padding;

    for (const comparison of comparisons) {
        const barWidth = Math.abs(comparison.changePercent / maxAbsChange) * barAreaWidth;
        const barX = comparison.changePercent >= 0 ? centerX : centerX - barWidth;

        let barClass: string;
        if (comparison.isImprovement) {
            barClass = 'bar-improvement';
        } else if (comparison.isRegression) {
            barClass = 'bar-regression';
        } else {
            barClass = 'bar-neutral';
        }

        // Label
        elements.push(
            `<text x="${opts.padding + opts.labelWidth - 10}" y="${currentY + opts.barHeight / 2 + 4}" class="label" text-anchor="end">${escapeXml(comparison.name)}</text>`,
        );

        // Bar
        elements.push(
            `<rect x="${barX}" y="${currentY}" width="${barWidth}" height="${opts.barHeight}" class="${barClass}" rx="2"/>`,
        );

        // Value
        const sign = comparison.changePercent >= 0 ? '+' : '';
        const valueX = comparison.changePercent >= 0 ? centerX + barWidth + 5 : centerX - barWidth - 5;
        const anchor = comparison.changePercent >= 0 ? 'start' : 'end';
        elements.push(
            `<text x="${valueX}" y="${currentY + opts.barHeight / 2 + 4}" class="value" text-anchor="${anchor}">${sign}${comparison.changePercent.toFixed(1)}%</text>`,
        );

        currentY += opts.barHeight + opts.barPadding;
    }

    // Legend
    const legendY = titleHeight + 10;
    const legendX = chartWidth - opts.padding - 280;

    elements.push(`<rect x="${legendX}" y="${legendY}" width="12" height="12" class="bar-improvement"/>`);
    elements.push(`<text x="${legendX + 18}" y="${legendY + 10}" class="label">Faster</text>`);
    elements.push(`<rect x="${legendX + 70}" y="${legendY}" width="12" height="12" class="bar-neutral"/>`);
    elements.push(`<text x="${legendX + 88}" y="${legendY + 10}" class="label">Similar</text>`);
    elements.push(`<rect x="${legendX + 150}" y="${legendY}" width="12" height="12" class="bar-regression"/>`);
    elements.push(`<text x="${legendX + 168}" y="${legendY + 10}" class="label">Slower</text>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">
${elements.join('\n')}
</svg>`;
}

/**
 * Generates a simple horizontal bar chart for a single suite
 *
 * @param suiteName - Name of the suite
 * @param results - Benchmark results for the suite
 * @param options - Chart options
 */
export function generateSuiteBarChart(
    suiteName: string,
    results: BenchSuiteResult,
    options: BarChartOptions = {},
): string {
    return generateBarChart(
        { [suiteName]: results },
        {
            ...options,
            title: options.title ?? suiteName,
        },
    );
}

/**
 * Generates a summary chart showing the fastest implementations per category
 *
 * @param results - Benchmark results grouped by suite name
 * @param options - Chart options
 */
export function generateSummaryChart(
    results: { [suiteName: string]: BenchSuiteResult },
    options: BarChartOptions = {},
): string {
    const opts: Required<BarChartOptions> = {
        width: options.width ?? 600,
        barHeight: options.barHeight ?? 30,
        barPadding: options.barPadding ?? 10,
        labelWidth: options.labelWidth ?? 200,
        valueWidth: options.valueWidth ?? 150,
        padding: options.padding ?? 20,
        title: options.title ?? 'Performance Summary - Fastest per Category',
        fontFamily: options.fontFamily ?? 'system-ui, -apple-system, sans-serif',
        deepkitPattern: options.deepkitPattern ?? /deepkit|@deepkit/i,
        groupPadding: options.groupPadding ?? 0,
    };

    // Get fastest per suite
    const summaryEntries: Array<{
        suiteName: string;
        name: string;
        hz: number;
        isDeepkit: boolean;
    }> = [];

    for (const [suiteName, suiteResults] of Object.entries(results)) {
        const entries = Object.entries(suiteResults)
            .map(([name, result]) => ({ name, hz: result.hz }))
            .sort((a, b) => b.hz - a.hz);

        if (entries.length > 0) {
            const fastest = entries[0];
            summaryEntries.push({
                suiteName,
                name: fastest.name,
                hz: fastest.hz,
                isDeepkit: opts.deepkitPattern.test(fastest.name),
            });
        }
    }

    // Calculate dimensions
    const titleHeight = 50;
    const chartHeight = titleHeight + summaryEntries.length * (opts.barHeight + opts.barPadding) + opts.padding * 2;

    const chartWidth = opts.width;
    const barAreaWidth = chartWidth - opts.labelWidth - opts.valueWidth - opts.padding * 2;

    const maxHz = Math.max(...summaryEntries.map(e => e.hz));

    // Generate SVG elements
    const elements: string[] = [];

    // Background
    elements.push(`<rect width="${chartWidth}" height="${chartHeight}" fill="${COLORS.background}"/>`);

    // Styles
    elements.push(generateStyles(opts.fontFamily));

    // Title
    elements.push(`<text x="${opts.padding}" y="${opts.padding + 20}" class="title">${escapeXml(opts.title)}</text>`);

    // Grid
    const gridX = opts.padding + opts.labelWidth;

    // Bars
    let currentY = titleHeight + opts.padding;

    for (const entry of summaryEntries) {
        const barWidth = (entry.hz / maxHz) * barAreaWidth;
        const barClass = entry.isDeepkit ? 'bar-deepkit' : 'bar-competitor';

        // Suite name as label
        elements.push(
            `<text x="${opts.padding + opts.labelWidth - 10}" y="${currentY + opts.barHeight / 2 + 4}" class="label" text-anchor="end">${escapeXml(entry.suiteName)}</text>`,
        );

        // Bar
        elements.push(
            `<rect x="${gridX}" y="${currentY}" width="${barWidth}" height="${opts.barHeight}" class="${barClass}" rx="3"/>`,
        );

        // Winner name and value
        elements.push(
            `<text x="${gridX + barWidth + 5}" y="${currentY + opts.barHeight / 2 + 4}" class="value">${escapeXml(entry.name)} (${formatNumber(entry.hz)} ops/s)</text>`,
        );

        currentY += opts.barHeight + opts.barPadding;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}">
${elements.join('\n')}
</svg>`;
}
