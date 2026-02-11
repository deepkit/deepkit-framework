#!/usr/bin/env node
/**
 * Run node:test for all packages that have a test:node script.
 * Usage: node scripts/run-tests.js [packages/core/ packages/http/ ...]
 *
 * If arguments are provided, only matching packages are tested.
 * Otherwise, all packages with test:node are tested.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages');
const args = process.argv.slice(2);

// Excluded packages (angular/gui)
const exclude = new Set([
    'angular-ssr', 'api-console-gui', 'api-console-module', 'orm-browser',
    'orm-browser-gui', 'orm-browser-api', 'framework-debug-gui',
    'desktop-ui', 'devtool', 'type-angular', 'ui-library',
]);

const packages = fs.readdirSync(packagesDir).filter(name => {
    if (exclude.has(name)) return false;
    const pkgJson = path.join(packagesDir, name, 'package.json');
    if (!fs.existsSync(pkgJson)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    return pkg.scripts && pkg.scripts['test:node'];
}).sort();

// Filter by args if provided
let toRun = packages;
if (args.length > 0) {
    toRun = packages.filter(name => {
        return args.some(arg => {
            const normalized = arg.replace(/\/$/, '').replace(/^packages\//, '');
            return name === normalized || name.startsWith(normalized);
        });
    });
}

console.log(`Running tests for ${toRun.length} packages...\n`);

let failed = 0;
for (const name of toRun) {
    const pkgDir = path.join(packagesDir, name);
    console.log(`\n=== @deepkit/${name} ===`);
    try {
        execSync('npm run test:node', {
            cwd: pkgDir,
            stdio: 'inherit',
            env: { ...process.env, NODE_OPTIONS: '--expose-gc --max_old_space_size=3048' },
        });
    } catch (e) {
        failed++;
        console.error(`FAILED: @deepkit/${name}`);
    }
}

if (failed > 0) {
    console.error(`\n${failed} package(s) failed.`);
    process.exit(1);
} else {
    console.log(`\nAll ${toRun.length} packages passed.`);
}
