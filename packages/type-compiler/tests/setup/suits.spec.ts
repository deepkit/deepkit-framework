import { expect, test } from '@jest/globals';
import * as ts from 'typescript';
import { TransformationContext } from 'typescript';

import { ReflectionTransformer } from '../../src/compiler.js';

function build(currentDir = process.cwd(), useConfig = 'tsconfig.json'): { [path: string]: string } {
    process.env.DEBUG = 'deepkit';
    const configFile = ts.findConfigFile(currentDir, ts.sys.fileExists, useConfig);
    if (!configFile) throw Error('tsconfig.json not found');
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);

    const { options, fileNames, errors } = ts.parseJsonConfigFileContent(config, ts.sys, currentDir);
    options.configFilePath = configFile;

    const program = ts.createProgram({ options, rootNames: fileNames, configFileParsingDiagnostics: errors });

    const result: { [path: string]: string } = {};
    program.emit(
        undefined,
        (fileName, data) => {
            //add basename to currentDir from fileName to result
            result[fileName.slice(currentDir.length + 1).replace(/\.js$/, '')] = data;
        },
        undefined,
        undefined,
        {
            before: [(context: TransformationContext) => new ReflectionTransformer(context)],
        },
    );

    return result;
}

test('suite1 base default', async () => {
    const files = build(__dirname + '/suite1');
    expect(files['file1']).toContain('WithTypes.__type');
    expect(files['backend/file3']).toContain('WithTypesBackend.__type');
    //frontend contains types because frontend/tsconfig.json is not picked.
    expect(files['frontend/file2']).toContain('WithoutTypesFrontend.__type');
});

test('suite1 base no-types', async () => {
    const files = build(__dirname + '/suite1', 'tsconfig.no-types.json');
    expect(files['file1']).toContain('WithTypes.__type');
    expect(files['backend/file3']).not.toContain('WithTypesBackend.__type');
    //frontend contains types because frontend/tsconfig.json is not picked.
    expect(files['frontend/file2']).not.toContain('WithoutTypesFrontend.__type');
});

test('suite1 frontend', async () => {
    const files = build(__dirname + '/suite1/frontend');
    expect(files.file2).not.toContain('WithoutTypesFrontend.__type');
});

test('suite1 backend', async () => {
    const files = build(__dirname + '/suite1/backend');
    expect(files.file3).toContain('WithTypesBackend.__type');
});
