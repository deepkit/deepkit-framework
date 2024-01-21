import { cli } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
import { existsSync, copySync } from 'fs-extra';
import { basename, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { findParentPath } from '@deepkit/app';
import { spawn } from 'child_process';

async function exec(command: string, cwd: string): Promise<void> {
    const child = spawn(command, { cwd: cwd, shell: true, stdio: 'inherit' });
    await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
    });
}

@cli.controller('create')
export class CreateController {
    constructor(private logger: Logger) {
    }

    async execute(
        path: string = 'deepkit-app'
    ) {
        const localPath = join(process.cwd(), path);
        if (existsSync(localPath)) {
            this.logger.log(`Folder <red>${localPath}</red> already exists.`);
            return;
        }
        this.logger.log(`Creating project in <green>${localPath}</green> ...`);

        const filesPath = findParentPath('files', __dirname);
        if (!filesPath) throw new Error(`No file template files found`);
        const node_modules = join(filesPath, 'node_modules');
        const package_json = join(filesPath, 'package-lock.json');
        const dist = join(filesPath, 'dist');
        const varDir = join(filesPath, 'var');

        copySync(filesPath, localPath, {
            recursive: true, filter: (src, dest) => {
                if (src.startsWith(node_modules) || src.startsWith(package_json) || src.startsWith(dist) || src.startsWith(varDir)) return false;
                return true;
            }
        });

        const packageJson = join(localPath, 'package.json');
        const packageJsonContent = JSON.parse(readFileSync(packageJson, 'utf8'));
        packageJsonContent.name = basename(path);
        writeFileSync(packageJson, JSON.stringify(packageJsonContent, undefined, 2), 'utf8');

        this.logger.log(`Install packages ...`);

        await exec('npm install', localPath);

        this.logger.log(`Initialize Git repo ...`);
        await exec('git init', localPath);

        this.logger.log(`<green>Success!</green> Make sure to update package.json accordingly.`);
    }
}
