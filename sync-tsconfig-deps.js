const fs = require('fs');

const packages = fs.readdirSync('packages/');

for (const name of packages) {
    const path = `packages/${name}`;
    if (!fs.lstatSync(path).isDirectory()) continue;

    const packageJsonPath = `${path}/package.json`;
    const tsConfigPath = `${path}/tsconfig.json`;

    if (!fs.existsSync(packageJsonPath)) throw new Error(`package ${name} has no package.json`);
    if (!fs.existsSync(tsConfigPath)) throw new Error(`package ${name} has no tsconfig.json`);

    console.log('processing', name);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath));

    const tsReferences = new Set();
    if (tsConfig['references']) {
        for (const dep of tsConfig['references']) {
            let path = dep['path'];
            path = path.substr(path.indexOf('/') + 1);
            path = path.substr(0, path.lastIndexOf('/'));
            tsReferences.add(path);
        }
    } else {
        continue;
    }

    let deps = [...Object.keys(packageJson['dependencies'] || {}), ...Object.keys(packageJson['devDependencies'] || {})];

    // console.log('   -> ts references', [...tsReferences]);
    // console.log('   -> deps', deps);

    for (const dep of deps) {
        if (dep.startsWith('@deepkit/')) {
            if (!tsReferences.has(dep)) {
                console.log(`  ERR: ${dep} as dependency, but not in tsconfig.json references.`);
            }
        }
    }
}
