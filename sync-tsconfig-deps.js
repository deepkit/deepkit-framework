const fs = require('fs');

const packages = fs.readdirSync('packages/');

const packageConfigs = {};
const tsConfigs = [];
const tsConfigESMs = [];

for (const name of packages) {
    const path = `packages/${name}`;
    if (!fs.lstatSync(path).isDirectory()) continue;

    const packageJsonPath = `${path}/package.json`;
    const tsConfigPath = `${path}/tsconfig.json`;
    const tsConfigESMPath = `${path}/tsconfig.esm.json`;

    if (!fs.existsSync(packageJsonPath)) throw new Error(`package ${name} has no package.json`);
    if (!fs.existsSync(tsConfigPath)) continue;
    tsConfigs.push(name);

    packageConfigs[name] = {
        path: path,
    };

    try {
        packageConfigs[name].package = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
    } catch (error) {
        throw new Error(`Could not read ${packageJsonPath}: ${error}`);
    }

    try {
        packageConfigs[name].tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, { encoding: 'utf8' }));
    } catch (error) {
        throw new Error(`Could not read ${tsConfigPath}: ${error}`);
    }

    try {
        if (fs.existsSync(tsConfigESMPath)) {
            packageConfigs[name].tsConfigESM = JSON.parse(fs.readFileSync(tsConfigESMPath, { encoding: 'utf8' }));
            tsConfigESMs.push(name);
        }
    } catch (error) {
        throw new Error(`Could not read ${tsConfigESMPath}: ${error}`);
    }
}

for (const [name, config] of Object.entries(packageConfigs)) {
    const deps = Array.from(new Set([
        ...Object.keys(config.package.dependencies || {}),
        ...Object.keys(config.package.devDependencies || {}),
        ...Object.keys(config.package.peerDependencies || {}),
    ])).filter(v => {
        const [, depName] = v.split('/');
        return v.startsWith('@deepkit/') && !fs.existsSync(`packages/${depName}/angular.json`);
    });

    const path = `packages/${name}`;
    const tsConfigPath = `${path}/tsconfig.json`;
    const tsConfigESMPath = `${path}/tsconfig.esm.json`;

    config.tsConfig.references = [];
    for (const dep of deps) {
        const [, depName] = dep.split('/');
        config.tsConfig.references.push({ path: `../${depName}/tsconfig.json` });
    }
    fs.writeFileSync(tsConfigPath, JSON.stringify(config.tsConfig, undefined, 2));

    if (config.tsConfigESM) {
        let tsConfigESMChanged = false;
        config.tsConfigESM.references = [];

        for (const dep of deps) {
            const [, depName] = dep.split('/');
            const requiredReference = fs.existsSync(`packages/${depName}/tsconfig.esm.json`)
                ? `../${depName}/tsconfig.esm.json` : `../${depName}/tsconfig.json`;
            config.tsConfigESM.references.push({ path: requiredReference });
        }
        fs.writeFileSync(tsConfigESMPath, JSON.stringify(config.tsConfigESM, undefined, 2));
    }
}

const rootTsConfig = JSON.parse(fs.readFileSync('tsconfig.json', { encoding: 'utf8' }));
const rootTsConfigESM = JSON.parse(fs.readFileSync('tsconfig.esm.json', { encoding: 'utf8' }));
rootTsConfig.references = tsConfigs.map(name => ({ path: `./packages/${name}/tsconfig.json` }));
rootTsConfigESM.references = tsConfigESMs.map(name => ({ path: `./packages/${name}/tsconfig.esm.json` }));
fs.writeFileSync('tsconfig.json', JSON.stringify(rootTsConfig, undefined, 2));
fs.writeFileSync('tsconfig.esm.json', JSON.stringify(rootTsConfigESM, undefined, 2));

//
// const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
// const tsReferences = new Set();
// const tsConfigString = fs.readFileSync(tsConfigPath, { encoding: 'utf8' });
// try {
//     const tsConfig = JSON.parse(tsConfigString);
//
//     if (tsConfig['references']) {
//         try {
//             if (fs.existsSync(tsConfigESMPath)) {
//                 const tsConfigCjs = JSON.parse(fs.readFileSync(tsConfigESMPath, {encoding: 'utf8'}));
//                 tsConfigCjs['references'] = tsConfig['references'].map(v => {
//                     return {path: v.path.replace('tsconfig.json', 'tsconfig.esm.json')}
//                 });
//                 fs.writeFileSync(tsConfigESMPath, JSON.stringify(tsConfigCjs, undefined, 2));
//             }
//         } catch (error) {
//             console.log('tsconfig.esm.json', tsConfigString);
//             throw error;
//         }
//
//         for (const dep of tsConfig['references']) {
//             let path = dep['path'];
//             if (path.startsWith('../')) {
//                 path = path.substr(path.indexOf('/') + 1);
//                 path = path.substr(0, path.lastIndexOf('/'));
//                 tsReferences.add('@deepkit/' + path);
//             }
//         }
//     } else {
//         continue;
//     }
// } catch (error) {
//     console.log('tsconfig.json', tsConfigString);
//     throw error;
// }
//
// let deps = [...Object.keys(packageJson['dependencies'] || {}), ...Object.keys(packageJson['devDependencies'] || {})];
//
// // console.log('   -> ts references', [...tsReferences]);
// // console.log('   -> deps', deps);
//
// for (const dep of deps) {
//     if (dep.startsWith('@deepkit/')) {
//         if (!tsReferences.has(dep)) {
//             console.log(`  ERR: ${dep} as dependency, but not in tsconfig.json references.`);
//         }
//     }
// }
// }
