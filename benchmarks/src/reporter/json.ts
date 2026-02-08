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

import type { BenchResult, BenchSuiteResult } from '@deepkit/bench';

/**
 * Metadata about the benchmark run environment
 */
export interface BenchmarkMetadata {
    /** ISO timestamp of when the benchmark was run */
    timestamp: string;
    /** Node.js version */
    nodeVersion: string;
    /** V8 engine version */
    v8Version: string;
    /** Operating system platform */
    platform: NodeJS.Platform;
    /** CPU architecture */
    arch: string;
    /** Git commit hash (if available) */
    gitCommit?: string;
    /** Git branch name (if available) */
    gitBranch?: string;
}

/**
 * Complete benchmark report structure
 */
export interface BenchmarkReport {
    /** Metadata about the run */
    metadata: BenchmarkMetadata;
    /** Results grouped by suite name */
    suites: { [suiteName: string]: BenchSuiteResult };
}

/**
 * Collects environment metadata for the benchmark report
 */
export function collectMetadata(): BenchmarkMetadata {
    const metadata: BenchmarkMetadata = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        v8Version: (process.versions as Record<string, string>).v8 || 'unknown',
        platform: process.platform,
        arch: process.arch,
    };

    // Try to get git info
    try {
        const { execSync } = require('child_process');
        metadata.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        metadata.gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
        // Git not available or not in a repo
    }

    return metadata;
}

/**
 * JSON Reporter - Outputs benchmark results to JSON files
 */
export class JsonReporter {
    private suites: { [suiteName: string]: BenchSuiteResult } = {};
    private metadata: BenchmarkMetadata;

    constructor() {
        this.metadata = collectMetadata();
    }

    /**
     * Adds suite results to the report
     *
     * @param suiteName - Name of the benchmark suite
     * @param results - Results from the suite
     */
    addSuiteResults(suiteName: string, results: BenchSuiteResult): void {
        this.suites[suiteName] = results;
    }

    /**
     * Gets the complete report object
     */
    getReport(): BenchmarkReport {
        return {
            metadata: this.metadata,
            suites: this.suites,
        };
    }

    /**
     * Writes the report to a JSON file
     *
     * @param filePath - Path to write the JSON file
     */
    writeToFile(filePath: string): void {
        const report = this.getReport();
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`Benchmark results written to: ${filePath}`);
    }

    /**
     * Generates a filename based on timestamp and git commit
     *
     * @param basePath - Base directory for the file
     * @param prefix - Optional prefix for the filename
     */
    generateFilename(basePath: string, prefix: string = 'benchmark'): string {
        const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const commit = this.metadata.gitCommit?.slice(0, 8) || 'unknown';
        return path.join(basePath, `${prefix}-${date}-${commit}.json`);
    }

    /**
     * Returns the report as a formatted JSON string
     */
    toString(): string {
        return JSON.stringify(this.getReport(), null, 2);
    }
}

/**
 * Reads a benchmark report from a JSON file
 *
 * @param filePath - Path to the JSON file
 */
export function readReport(filePath: string): BenchmarkReport {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BenchmarkReport;
}

/**
 * Lists all benchmark report files in a directory
 *
 * @param dirPath - Directory to search
 */
export function listReports(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
        return [];
    }

    return fs
        .readdirSync(dirPath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(dirPath, file))
        .sort();
}

/**
 * Gets the latest benchmark report from a directory
 *
 * @param dirPath - Directory to search
 */
export function getLatestReport(dirPath: string): BenchmarkReport | null {
    const reports = listReports(dirPath);
    if (reports.length === 0) {
        return null;
    }

    return readReport(reports[reports.length - 1]);
}
