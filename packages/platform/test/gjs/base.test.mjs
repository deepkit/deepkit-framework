import GLib from 'gi://GLib';
import { getDirname, getFilename } from '../../dist/esm/index.js';
import { exit } from 'system';
const byteArray = imports.byteArray;

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

const crossDirname = getDirname();
const crossFilename = getFilename();

const getOriginalDirname = () => {
    const rootDir = crossDirname;
    let [res, out, err, status] = GLib.spawn_command_line_sync(`node ${rootDir}/get-original-dirname.js`);
    err = err ? byteArray.toString(err) : err;
    const __dirname = out ? byteArray.toString(out).trim() : undefined;
    if (err) {
        console.error(err);
    }
    return __dirname;
}

const getOriginalFilename = () => {
    return getOriginalDirname() + '/base.test.mjs';
}

let passing = 0;
let failed = 0;

/////////// __dirname ///////////
{
    const __dirname = getOriginalDirname();

    print("GJS");
    print(`\tgetDirname() \t-> "${crossDirname}"`);
    print(`\t__dirname \t-> "${__dirname}"`);

    if (crossDirname === __dirname) {
        print(`${GREEN}✔${RESET} getDirname() should return the same string as __dirname\n`)
        passing++;
    } else {
        print(`${RED}failed${RESET}\n`);
        failed++;
    }
}

/////////// __filename ///////////
{
    const __filename = getOriginalFilename();

    print(`\tgetFilename() \t-> "${crossFilename}"`);
    print(`\t__filename \t-> "${__filename}"`);

    if (crossFilename === __filename) {
        print(`${GREEN}✔${RESET} getFilename() should return the same string as __filename\n`)
        passing++;
    } else {
        print(`${RED}failed${RESET}\n`);
        failed++;
    }
}

/////////// REPORT ///////////

print(`${GREEN}${passing} passing${RESET}`);
print(`${failed > 0 ? RED : RESET}${failed} failed${RESET}`);


if(failed > 0) {
    exit(1);
}