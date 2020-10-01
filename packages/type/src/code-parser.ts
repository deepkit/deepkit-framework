export function extractMethod(classCode: string, name: string): string {
    let methodCode = '';
    classCode = removeStrings(classCode);
    const start = classCode.match(new RegExp('[\t\ \n]' + name + '\\('));
    if (!start) return '';

    classCode = classCode.substr((start.index || 0) + start[0].length);

    let blockDepth = 1;
    classCode = classCode.substr(classCode.indexOf('{') + 1);

    for (let i = 0; i < classCode.length; i++) {
        const char = classCode[i];
        if (char === '{') blockDepth++;
        if (char === '}') blockDepth--;

        if (blockDepth === 0) {
            return methodCode;
        }

        if (char === '\n' || char === '\t' || char === ' ') continue;
        methodCode += char;
    }

    return methodCode;
}

export function removeStrings(code: string) {
    let result = '';
    let inString: false | '"' | '\'' = false;
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (inString && char === '\\') {
            i++;
            continue;
        }

        if (char === '"') {
            if (inString === '"') {
                //end string
                inString = false;
                continue;
            }
            if (!inString) {
                inString = '"';
                continue;
            }
        }

        if (char === '\'') {
            if (inString === '\'') {
                //end string
                inString = false;
                continue;
            }
            if (!inString) {
                inString = '\'';
                continue;
            }
        }

        if (!inString) {
            result += char;
        }
    }
    return result;
}
