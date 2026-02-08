/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { BenchSuiteResult } from '@deepkit/bench';
import { formatHz } from '@deepkit/bench';

import { BenchmarkReport, JsonReporter, getLatestReport, listReports, readReport } from './json';

// ANSI color codes
const Reset = '\x1b[0m';
const Bold = '\x1b[1m';
const FgRed = '\x1b[31m';
const FgGreen = '\x1b[32m';
const FgYellow = '\x1b[33m';
const FgCyan = '\x1b[36m';

function green(text: string): string {
    return `${FgGreen}${text}${Reset}`;
}

function red(text: string): string {
    return `${FgRed}${text}${Reset}`;
}

function yellow(text: string): string {
    return `${FgYellow}${text}${Reset}`;
}

function cyan(text: string): string {
    return `${FgCyan}${text}${Reset}`;
}

function bold(text: string): string {
    return `${Bold}${text}${Reset}`;
}

/**
 * Comparison result for a single benchmark
 */
export interface BenchmarkComparison {
    /** Benchmark name */
    name: string;
    /** Baseline ops/sec */
    baselineHz: number;
    /** Current ops/sec */
    currentHz: number;
    /** Percentage change (positive = improvement, negative = regression) */
    changePercent: number;
    /** Whether this is a significant change (beyond threshold) */
    significant: boolean;
    /** Whether this is a regression */
    regression: boolean;
    /** Whether this is an improvement */
    improvement: boolean;
}

/**
 * Comparison result for a suite
 */
export interface SuiteComparison {
    /** Suite name */
    suiteName: string;
    /** Individual benchmark comparisons */
    benchmarks: BenchmarkComparison[];
    /** Number of regressions */
    regressionCount: number;
    /** Number of improvements */
    improvementCount: number;
    /** Overall status */
    status: 'pass' | 'warn' | 'fail';
}

/**
 * Options for comparison
 */
export interface ComparisonOptions {
    /** Threshold percentage for significant change (default: 5%) */
    threshold?: number;
    /** Threshold for regression warning (default: 10%) */
    warningThreshold?: number;
    /** Threshold for regression failure (default: 20%) */
    failureThreshold?: number;
    /** Use colors in output */
    colors?: boolean;
}

/**
 * Compares two benchmark reports and returns comparison results
 */
export function compareReports(
    baseline: BenchmarkReport,
    current: BenchmarkReport,
    options: ComparisonOptions = {},
): SuiteComparison[] {
    const threshold = options.threshold ?? 5;
    const comparisons: SuiteComparison[] = [];

    for (const [suiteName, currentResults] of Object.entries(current.suites)) {
        const baselineResults = baseline.suites[suiteName];
        if (!baselineResults) {
            continue; // Skip suites that don't exist in baseline
        }

        const benchmarkComparisons: BenchmarkComparison[] = [];
        let regressionCount = 0;
        let improvementCount = 0;

        for (const [benchName, currentResult] of Object.entries(currentResults)) {
            const baselineResult = baselineResults[benchName];
            if (!baselineResult) {
                continue; // Skip benchmarks that don't exist in baseline
            }

            const changePercent = ((currentResult.hz - baselineResult.hz) / baselineResult.hz) * 100;
            const significant = Math.abs(changePercent) >= threshold;
            const regression = changePercent < -threshold;
            const improvement = changePercent > threshold;

            if (regression) regressionCount++;
            if (improvement) improvementCount++;

            benchmarkComparisons.push({
                name: benchName,
                baselineHz: baselineResult.hz,
                currentHz: currentResult.hz,
                changePercent,
                significant,
                regression,
                improvement,
            });
        }

        const warningThreshold = options.warningThreshold ?? 10;
        const failureThreshold = options.failureThreshold ?? 20;

        // Determine status based on worst regression
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        for (const comp of benchmarkComparisons) {
            if (comp.changePercent < -failureThreshold) {
                status = 'fail';
                break;
            } else if (comp.changePercent < -warningThreshold) {
                status = 'warn';
            }
        }

        comparisons.push({
            suiteName,
            benchmarks: benchmarkComparisons,
            regressionCount,
            improvementCount,
            status,
        });
    }

    return comparisons;
}

/**
 * Comparison Reporter - Compares benchmark results against a baseline
 */
export class ComparisonReporter {
    private options: ComparisonOptions;

    constructor(options: ComparisonOptions = {}) {
        this.options = {
            threshold: options.threshold ?? 5,
            warningThreshold: options.warningThreshold ?? 10,
            failureThreshold: options.failureThreshold ?? 20,
            colors: options.colors ?? true,
        };
    }

    /**
     * Compares current results against a baseline file
     */
    compareWithBaseline(
        baselinePath: string,
        currentResults: { [suiteName: string]: BenchSuiteResult },
    ): SuiteComparison[] {
        const baseline = readReport(baselinePath);
        const current: BenchmarkReport = {
            metadata: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                v8Version: (process.versions as Record<string, string>).v8 || 'unknown',
                platform: process.platform,
                arch: process.arch,
            },
            suites: currentResults,
        };

        return compareReports(baseline, current, this.options);
    }

    /**
     * Compares current results against the latest baseline in a directory
     */
    compareWithLatestBaseline(
        baselineDir: string,
        currentResults: { [suiteName: string]: BenchSuiteResult },
    ): SuiteComparison[] | null {
        const baseline = getLatestReport(baselineDir);
        if (!baseline) {
            console.log('No baseline found for comparison');
            return null;
        }

        const current: BenchmarkReport = {
            metadata: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                v8Version: (process.versions as Record<string, string>).v8 || 'unknown',
                platform: process.platform,
                arch: process.arch,
            },
            suites: currentResults,
        };

        return compareReports(baseline, current, this.options);
    }

    /**
     * Prints comparison results to console
     */
    printComparison(comparisons: SuiteComparison[]): void {
        console.log();
        console.log(this.options.colors ? bold('='.repeat(80)) : '='.repeat(80));
        console.log(
            this.options.colors
                ? bold('                      BASELINE COMPARISON')
                : '                      BASELINE COMPARISON',
        );
        console.log(this.options.colors ? bold('='.repeat(80)) : '='.repeat(80));
        console.log();

        for (const suite of comparisons) {
            this.printSuiteComparison(suite);
        }

        // Print overall summary
        this.printOverallSummary(comparisons);
    }

    /**
     * Prints comparison for a single suite
     */
    private printSuiteComparison(suite: SuiteComparison): void {
        // Status indicator
        let statusIcon: string;
        if (suite.status === 'pass') {
            statusIcon = this.options.colors ? green('[PASS]') : '[PASS]';
        } else if (suite.status === 'warn') {
            statusIcon = this.options.colors ? yellow('[WARN]') : '[WARN]';
        } else {
            statusIcon = this.options.colors ? red('[FAIL]') : '[FAIL]';
        }

        console.log(`${statusIcon} ${this.options.colors ? bold(suite.suiteName) : suite.suiteName}`);
        console.log('-'.repeat(80));

        // Sort by change percentage (regressions first)
        const sorted = [...suite.benchmarks].sort((a, b) => a.changePercent - b.changePercent);

        for (const bench of sorted) {
            this.printBenchmarkComparison(bench);
        }

        console.log();
        console.log(`  Regressions: ${suite.regressionCount}, Improvements: ${suite.improvementCount}`);
        console.log();
    }

    /**
     * Prints comparison for a single benchmark
     */
    private printBenchmarkComparison(bench: BenchmarkComparison): void {
        const changeStr =
            bench.changePercent >= 0 ? `+${bench.changePercent.toFixed(2)}%` : `${bench.changePercent.toFixed(2)}%`;

        let changeDisplay: string;
        if (bench.regression) {
            changeDisplay = this.options.colors ? red(changeStr) : `${changeStr} (regression)`;
        } else if (bench.improvement) {
            changeDisplay = this.options.colors ? green(changeStr) : `${changeStr} (improvement)`;
        } else {
            changeDisplay = changeStr;
        }

        // Arrow indicator
        let arrow: string;
        if (bench.regression) {
            arrow = this.options.colors ? red('\u2193') : 'v';
        } else if (bench.improvement) {
            arrow = this.options.colors ? green('\u2191') : '^';
        } else {
            arrow = '=';
        }

        console.log(
            `  ${arrow} ${changeDisplay.padStart(12)}  ` +
                `${formatHz(bench.baselineHz).padStart(15)} -> ${formatHz(bench.currentHz).padStart(15)} ops/sec  ` +
                `${bench.name}`,
        );
    }

    /**
     * Prints overall summary across all suites
     */
    private printOverallSummary(comparisons: SuiteComparison[]): void {
        const totalRegressions = comparisons.reduce((sum, s) => sum + s.regressionCount, 0);
        const totalImprovements = comparisons.reduce((sum, s) => sum + s.improvementCount, 0);
        const failedSuites = comparisons.filter(s => s.status === 'fail').length;
        const warnedSuites = comparisons.filter(s => s.status === 'warn').length;

        console.log('='.repeat(80));
        console.log(this.options.colors ? bold('Overall Summary:') : 'Overall Summary:');
        console.log(`  Total Regressions: ${totalRegressions}`);
        console.log(`  Total Improvements: ${totalImprovements}`);
        console.log(`  Failed Suites: ${failedSuites}`);
        console.log(`  Warned Suites: ${warnedSuites}`);

        if (failedSuites > 0) {
            console.log();
            console.log(this.options.colors ? red(bold('BENCHMARK COMPARISON FAILED')) : 'BENCHMARK COMPARISON FAILED');
        } else if (warnedSuites > 0) {
            console.log();
            console.log(
                this.options.colors
                    ? yellow('Benchmark comparison passed with warnings')
                    : 'Benchmark comparison passed with warnings',
            );
        } else {
            console.log();
            console.log(this.options.colors ? green('Benchmark comparison passed') : 'Benchmark comparison passed');
        }
        console.log();
    }

    /**
     * Returns exit code based on comparison results
     * 0 = pass, 1 = fail
     */
    getExitCode(comparisons: SuiteComparison[]): number {
        const hasFailed = comparisons.some(s => s.status === 'fail');
        return hasFailed ? 1 : 0;
    }
}

/**
 * Saves current results as a new baseline
 */
export function saveBaseline(
    results: { [suiteName: string]: BenchSuiteResult },
    baselineDir: string,
    filename?: string,
): string {
    const reporter = new JsonReporter();

    for (const [name, result] of Object.entries(results)) {
        reporter.addSuiteResults(name, result);
    }

    const filePath = filename ? path.join(baselineDir, filename) : reporter.generateFilename(baselineDir);

    reporter.writeToFile(filePath);
    return filePath;
}

/**
 * Compare current results with the latest baseline and print report
 */
export function compareWithBaseline(
    currentResults: { [suiteName: string]: BenchSuiteResult },
    baselineDir: string,
    options?: ComparisonOptions,
): number {
    const reporter = new ComparisonReporter(options);
    const comparisons = reporter.compareWithLatestBaseline(baselineDir, currentResults);

    if (!comparisons) {
        console.log('No baseline available for comparison. Run with --save-baseline first.');
        return 0;
    }

    reporter.printComparison(comparisons);
    return reporter.getExitCode(comparisons);
}
