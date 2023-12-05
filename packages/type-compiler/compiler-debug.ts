import { deepkitType } from './src/plugin.js';
import { readFileSync } from 'fs';

interface Arguments {
    file: string;
    config?: string;
}

function parseArguments(args: string[]): Arguments {
    const result: Arguments = {
        file: '',
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--config') {
            result.config = args[i + 1];
            i++;
        } else {
            result.file = arg;
        }
    }

    return result;
}

const args = parseArguments(process.argv.slice(2));



const transformer = deepkitType({
    tsConfig: args.config,
});

const code = readFileSync(args.file, 'utf8');
const transformed = transformer(code, args.file);

console.log(transformed?.code);
