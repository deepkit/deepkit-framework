const path = require('path');
const fs = require('fs/promises');

const search = async (dir, regex, ext, exclude) => {
    const files = await getFiles(dir, ext, exclude);
    const result = [];

    for (file of files) {
        const content = await fs.readFile(file, 'utf8');

        if (regex.test(content)) {
            result.push(file);
        }
    };

    return result;
}

/**
 *
 * @param {string} dir
 * @param {string} ext
 * @param {string[]} excludes
 * @returns
 */
const getFiles = async (dir, ext, excludes) => {
    let files = [];

    if(excludes.find(exclude => dir.includes(exclude))) {
        console.debug("exclude", dir)
        return files;
    }

    const stat = await fs.lstat(dir);
    if (!stat.isDirectory()) {
        return files;
    }

    const dirFiles = await fs.readdir(dir);

    for (let file of dirFiles) {
        const filePath = path.join(dir, file);

        if(excludes.find(exclude => filePath.includes(exclude))) {
            continue
        }

        const stat = await fs.lstat(filePath);

        if (stat.isDirectory()) {
            const nestedFiles = await getFiles(filePath, ext, excludes);
            files = files.concat(nestedFiles);
        } else if (stat.isFile()) {
            if (path.extname(file) === ext) {
                files.push(filePath);
            }
        }
    };

    return files;
}

search('./packages', /(import|from) ("|')\..*(?<!.js)("|')/g, '.ts', ['dist', 'node_modules', 'compiler.spec.ts', 'mod.ts']).then((files)=> {
    if(files.length) {
        console.error(`Imports without file extension found!`);
        console.error('\t' + files.join('\n\t'));
        process.exit(1);
    }
    console.info("All imports are looking good :)");
    process.exit(0);

}).catch((error) => {
    console.error(error);
})
