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
import { formatHz, formatMean } from '@deepkit/bench';

import { BenchmarkComparison, SuiteComparison, compareReports } from './comparison';
import { BenchmarkMetadata, BenchmarkReport } from './json';

/**
 * Progress bar characters for visual representation
 */
const PROGRESS_BLOCKS = ['', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

/**
 * Options for markdown generation
 */
export interface MarkdownOptions {
    /** Include metadata section */
    includeMetadata?: boolean;
    /** Include progress bars */
    includeProgressBars?: boolean;
    /** Maximum width for progress bars (in characters) */
    progressBarWidth?: number;
    /** Group results by category */
    groupByCategory?: boolean;
    /** Show comparison with baseline */
    showComparison?: boolean;
}

/**
 * Generates a visual progress bar using Unicode block characters
 *
 * @param value - Current value (0-1 normalized)
 * @param width - Width of the bar in characters
 */
function generateProgressBar(value: number, width: number = 20): string {
    const normalizedValue = Math.max(0, Math.min(1, value));
    const fullBlocks = Math.floor(normalizedValue * width);
    const remainder = normalizedValue * width - fullBlocks;
    const partialBlockIndex = Math.round(remainder * (PROGRESS_BLOCKS.length - 1));

    let bar = '\u2588'.repeat(fullBlocks);
    if (fullBlocks < width && partialBlockIndex > 0) {
        bar += PROGRESS_BLOCKS[partialBlockIndex];
    }

    return bar;
}

/**
 * Escapes special Markdown characters in a string
 */
function escapeMarkdown(text: string): string {
    return text.replace(/[|\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

/**
 * Formats a percentage change with sign and color indicator
 */
function formatChange(changePercent: number): string {
    const sign = changePercent >= 0 ? '+' : '';
    const emoji = changePercent > 5 ? '\u2191' : changePercent < -5 ? '\u2193' : '\u2194';
    return `${emoji} ${sign}${changePercent.toFixed(2)}%`;
}

/**
 * Generates metadata section for the markdown report
 */
function generateMetadataSection(metadata: BenchmarkMetadata): string {
    const lines: string[] = [
        '## Environment',
        '',
        '| Property | Value |',
        '|----------|-------|',
        `| Timestamp | ${metadata.timestamp} |`,
        `| Node.js | ${metadata.nodeVersion} |`,
        `| V8 | ${metadata.v8Version} |`,
        `| Platform | ${metadata.platform} |`,
        `| Architecture | ${metadata.arch} |`,
    ];

    if (metadata.gitCommit) {
        lines.push(`| Git Commit | \`${metadata.gitCommit.slice(0, 8)}\` |`);
    }
    if (metadata.gitBranch) {
        lines.push(`| Git Branch | ${metadata.gitBranch} |`);
    }

    lines.push('');
    return lines.join('\n');
}

/**
 * Generates a markdown table for a single suite
 */
function generateSuiteTable(
    suiteName: string,
    results: BenchSuiteResult,
    options: MarkdownOptions,
    baseline?: BenchSuiteResult,
): string {
    const entries = Object.entries(results)
        .map(([name, result]) => ({ name, ...result }))
        .sort((a, b) => b.hz - a.hz);

    if (entries.length === 0) {
        return '';
    }

    const fastest = entries[0];
    const lines: string[] = [`### ${suiteName}`, ''];

    // Table header
    const headers = ['Name', 'ops/sec', 'ms/op', 'RME'];
    if (options.includeProgressBars) {
        headers.push('Performance');
    }
    headers.push('Factor');
    if (baseline && options.showComparison) {
        headers.push('vs Baseline');
    }

    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('|' + headers.map(() => '---').join('|') + '|');

    // Table rows
    for (const entry of entries) {
        const factor = fastest.hz / entry.hz;
        const normalizedPerformance = entry.hz / fastest.hz;

        const row: string[] = [entry.name, formatHz(entry.hz), formatMean(entry.mean), `\xb1${entry.rme.toFixed(2)}%`];

        if (options.includeProgressBars) {
            const bar = generateProgressBar(normalizedPerformance, options.progressBarWidth || 15);
            row.push(`\`${bar}\``);
        }

        row.push(factor === 1 ? '**fastest**' : `x${factor.toFixed(2)}`);

        if (baseline && options.showComparison && baseline[entry.name]) {
            const baselineHz = baseline[entry.name].hz;
            const changePercent = ((entry.hz - baselineHz) / baselineHz) * 100;
            row.push(formatChange(changePercent));
        } else if (baseline && options.showComparison) {
            row.push('N/A');
        }

        lines.push('| ' + row.join(' | ') + ' |');
    }

    lines.push('');
    return lines.join('\n');
}

/**
 * Generates a comparison summary section
 */
function generateComparisonSummary(comparisons: SuiteComparison[]): string {
    const lines: string[] = [
        '## Comparison Summary',
        '',
        '| Suite | Regressions | Improvements | Status |',
        '|-------|-------------|--------------|--------|',
    ];

    for (const suite of comparisons) {
        const statusEmoji = suite.status === 'pass' ? '\u2705' : suite.status === 'warn' ? '\u26a0\ufe0f' : '\u274c';
        lines.push(
            `| ${suite.suiteName} | ${suite.regressionCount} | ${suite.improvementCount} | ${statusEmoji} ${suite.status.toUpperCase()} |`,
        );
    }

    const totalRegressions = comparisons.reduce((sum, s) => sum + s.regressionCount, 0);
    const totalImprovements = comparisons.reduce((sum, s) => sum + s.improvementCount, 0);

    lines.push('');
    lines.push(`**Total Regressions:** ${totalRegressions}`);
    lines.push(`**Total Improvements:** ${totalImprovements}`);
    lines.push('');

    return lines.join('\n');
}

/**
 * Generates a complete markdown summary from benchmark results
 *
 * @param results - Benchmark results grouped by suite name
 * @param options - Generation options
 * @param baseline - Optional baseline for comparison
 */
export function generateMarkdownSummary(
    results: { [suiteName: string]: BenchSuiteResult },
    baseline?: { [suiteName: string]: BenchSuiteResult },
    options: MarkdownOptions = {},
): string {
    const opts: MarkdownOptions = {
        includeMetadata: options.includeMetadata ?? false,
        includeProgressBars: options.includeProgressBars ?? true,
        progressBarWidth: options.progressBarWidth ?? 15,
        groupByCategory: options.groupByCategory ?? false,
        showComparison: options.showComparison ?? !!baseline,
    };

    const lines: string[] = ['# Benchmark Results', ''];

    // Generate suite tables
    for (const [suiteName, suiteResults] of Object.entries(results)) {
        const baselineResults = baseline ? baseline[suiteName] : undefined;
        lines.push(generateSuiteTable(suiteName, suiteResults, opts, baselineResults));
    }

    return lines.join('\n');
}

/**
 * Generates a complete markdown report from a BenchmarkReport
 *
 * @param report - Complete benchmark report
 * @param baseline - Optional baseline report for comparison
 * @param options - Generation options
 */
export function generateMarkdownReport(
    report: BenchmarkReport,
    baseline?: BenchmarkReport,
    options: MarkdownOptions = {},
): string {
    const opts: MarkdownOptions = {
        includeMetadata: options.includeMetadata ?? true,
        includeProgressBars: options.includeProgressBars ?? true,
        progressBarWidth: options.progressBarWidth ?? 15,
        groupByCategory: options.groupByCategory ?? false,
        showComparison: options.showComparison ?? !!baseline,
    };

    const lines: string[] = ['# Benchmark Results', ''];

    // Metadata section
    if (opts.includeMetadata) {
        lines.push(generateMetadataSection(report.metadata));
    }

    // Comparison summary
    if (baseline && opts.showComparison) {
        const comparisons = compareReports(baseline, report);
        lines.push(generateComparisonSummary(comparisons));
    }

    // Suite tables
    lines.push('## Results');
    lines.push('');

    for (const [suiteName, suiteResults] of Object.entries(report.suites)) {
        const baselineResults = baseline ? baseline.suites[suiteName] : undefined;
        lines.push(generateSuiteTable(suiteName, suiteResults, opts, baselineResults));
    }

    return lines.join('\n');
}

/**
 * Generates a simple text-based summary (for console output without ANSI)
 */
export function generateTextSummary(results: { [suiteName: string]: BenchSuiteResult }): string {
    const lines: string[] = [];

    for (const [suiteName, suiteResults] of Object.entries(results)) {
        const entries = Object.entries(suiteResults)
            .map(([name, result]) => ({ name, ...result }))
            .sort((a, b) => b.hz - a.hz);

        if (entries.length === 0) continue;

        const fastest = entries[0];

        lines.push(`Benchmark: ${suiteName}`);
        lines.push('-'.repeat(60));

        for (const entry of entries) {
            const factor = fastest.hz / entry.hz;
            const marker = factor === 1 ? '*' : ' ';
            lines.push(
                `${marker} ${formatHz(entry.hz).padStart(15)} ops/sec  x${factor.toFixed(2).padStart(5)}  ${entry.name}`,
            );
        }

        lines.push('');
    }

    return lines.join('\n');
}
