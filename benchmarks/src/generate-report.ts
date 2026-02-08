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

import { BenchmarkReport, getLatestReport, readReport } from './reporter/json';
import { MarkdownOptions, generateMarkdownReport, generateMarkdownSummary } from './reporter/markdown';
import { BarChartOptions, generateBarChart, generateComparisonChart, generateSummaryChart } from './reporter/svg';

/**
 * CLI options for report generation
 */
interface GenerateReportOptions {
    /** Input results file (JSON) */
    input: string;
    /** Output directory */
    outputDir: string;
    /** Baseline file or directory for comparison */
    baseline?: string;
    /** Chart width */
    chartWidth?: number;
    /** Generate markdown report */
    markdown?: boolean;
    /** Generate SVG charts */
    svg?: boolean;
    /** Generate summary chart */
    summary?: boolean;
    /** Generate comparison chart */
    comparison?: boolean;
    /** Verbose output */
    verbose?: boolean;
}

/**
 * Parses command line arguments
 */
function parseArgs(): GenerateReportOptions {
    const args = process.argv.slice(2);
    const options: Partial<GenerateReportOptions> = {
        markdown: true,
        svg: true,
        summary: true,
        comparison: false,
        verbose: false,
    };

    let positionalIndex = 0;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '-o':
            case '--output':
                options.outputDir = args[++i];
                break;
            case '-b':
            case '--baseline':
                options.baseline = args[++i];
                options.comparison = true;
                break;
            case '-w':
            case '--width':
                options.chartWidth = parseInt(args[++i], 10);
                break;
            case '--no-markdown':
                options.markdown = false;
                break;
            case '--no-svg':
                options.svg = false;
                break;
            case '--no-summary':
                options.summary = false;
                break;
            case '-v':
            case '--verbose':
                options.verbose = true;
                break;
            case '-h':
            case '--help':
                printHelp();
                process.exit(0);
                break;
            default:
                if (!arg.startsWith('-')) {
                    if (positionalIndex === 0) {
                        options.input = arg;
                        positionalIndex++;
                    }
                } else {
                    console.error(`Unknown option: ${arg}`);
                    process.exit(1);
                }
        }
    }

    // Validate required options
    if (!options.input) {
        console.error('Error: Input file is required');
        console.error('Usage: npx ts-node src/generate-report.ts <results.json> -o <output-dir>');
        process.exit(1);
    }

    if (!options.outputDir) {
        options.outputDir = './report';
    }

    return options as GenerateReportOptions;
}

/**
 * Prints help message
 */
function printHelp(): void {
    console.log(`
Deepkit Benchmark Report Generator

Usage: npx ts-node src/generate-report.ts <results.json> [options]

Arguments:
  <results.json>          Path to benchmark results JSON file

Options:
  -o, --output <dir>      Output directory for generated reports (default: ./report)
  -b, --baseline <path>   Baseline file or directory for comparison charts
  -w, --width <pixels>    Chart width in pixels (default: 800)
  --no-markdown           Don't generate markdown report
  --no-svg                Don't generate SVG charts
  --no-summary            Don't generate summary chart
  -v, --verbose           Verbose output
  -h, --help              Show this help message

Examples:
  npx ts-node src/generate-report.ts results.json -o ./report
  npx ts-node src/generate-report.ts results.json -o ./report -b baselines/
  npx ts-node src/generate-report.ts results.json -o ./report --width 1000

Output:
  The generator creates the following files in the output directory:
  - report.md           Markdown summary of benchmark results
  - chart.svg           Bar chart of all benchmarks
  - summary.svg         Summary chart showing fastest per category
  - comparison.svg      Comparison chart (if baseline provided)
`);
}

/**
 * Ensures the output directory exists
 */
function ensureOutputDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Loads a baseline report from a file or directory
 */
function loadBaseline(baselinePath: string): BenchmarkReport | null {
    if (!fs.existsSync(baselinePath)) {
        console.warn(`Baseline path not found: ${baselinePath}`);
        return null;
    }

    const stat = fs.statSync(baselinePath);

    if (stat.isDirectory()) {
        return getLatestReport(baselinePath);
    } else {
        return readReport(baselinePath);
    }
}

/**
 * Main report generation function
 */
async function generateReports(options: GenerateReportOptions): Promise<void> {
    console.log('Deepkit Benchmark Report Generator');
    console.log('==================================');
    console.log();

    // Load input file
    if (!fs.existsSync(options.input)) {
        console.error(`Error: Input file not found: ${options.input}`);
        process.exit(1);
    }

    console.log(`Reading results from: ${options.input}`);
    const report = readReport(options.input);

    // Load baseline if specified
    let baseline: BenchmarkReport | null = null;
    if (options.baseline) {
        console.log(`Loading baseline from: ${options.baseline}`);
        baseline = loadBaseline(options.baseline);
        if (!baseline) {
            console.warn('Warning: Could not load baseline, skipping comparison');
            options.comparison = false;
        }
    }

    // Ensure output directory exists
    ensureOutputDir(options.outputDir);
    console.log(`Output directory: ${options.outputDir}`);
    console.log();

    const chartOptions: BarChartOptions = {
        width: options.chartWidth || 800,
    };

    const markdownOptions: MarkdownOptions = {
        includeMetadata: true,
        includeProgressBars: true,
        showComparison: !!baseline,
    };

    // Generate markdown report
    if (options.markdown) {
        const markdownPath = path.join(options.outputDir, 'report.md');
        console.log(`Generating markdown report: ${markdownPath}`);

        const markdown = generateMarkdownReport(report, baseline || undefined, markdownOptions);
        fs.writeFileSync(markdownPath, markdown, 'utf-8');

        if (options.verbose) {
            console.log(`  - Included ${Object.keys(report.suites).length} suite(s)`);
        }
    }

    // Generate bar chart
    if (options.svg) {
        const chartPath = path.join(options.outputDir, 'chart.svg');
        console.log(`Generating bar chart: ${chartPath}`);

        const svg = generateBarChart(report.suites, {
            ...chartOptions,
            title: 'Benchmark Results',
        });
        fs.writeFileSync(chartPath, svg, 'utf-8');

        if (options.verbose) {
            const totalBenchmarks = Object.values(report.suites).reduce(
                (sum, suite) => sum + Object.keys(suite).length,
                0,
            );
            console.log(`  - Included ${totalBenchmarks} benchmark(s)`);
        }
    }

    // Generate summary chart
    if (options.summary && options.svg) {
        const summaryPath = path.join(options.outputDir, 'summary.svg');
        console.log(`Generating summary chart: ${summaryPath}`);

        const svg = generateSummaryChart(report.suites, {
            ...chartOptions,
            width: (chartOptions.width || 800) * 0.75,
            title: 'Performance Summary - Fastest per Category',
        });
        fs.writeFileSync(summaryPath, svg, 'utf-8');
    }

    // Generate comparison chart
    if (options.comparison && baseline && options.svg) {
        const comparisonPath = path.join(options.outputDir, 'comparison.svg');
        console.log(`Generating comparison chart: ${comparisonPath}`);

        const svg = generateComparisonChart(report.suites, baseline.suites, {
            ...chartOptions,
            title: 'Performance Comparison vs Baseline',
        });
        fs.writeFileSync(comparisonPath, svg, 'utf-8');
    }

    console.log();
    console.log('Report generation complete!');
    console.log();

    // Print summary
    console.log('Generated files:');
    const files = fs.readdirSync(options.outputDir);
    for (const file of files) {
        const filePath = path.join(options.outputDir, file);
        const stat = fs.statSync(filePath);
        const sizeKB = (stat.size / 1024).toFixed(2);
        console.log(`  - ${file} (${sizeKB} KB)`);
    }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    try {
        const options = parseArgs();
        await generateReports(options);
    } catch (error) {
        console.error('Error generating report:', error);
        process.exit(1);
    }
}

// Export for programmatic use
export { generateReports, GenerateReportOptions };
export * from './reporter/markdown';
export * from './reporter/svg';

// Run if executed directly
if (require.main === module) {
    main();
}
