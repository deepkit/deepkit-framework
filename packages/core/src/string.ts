export function indent(indentation: number) {
    return (str: string) => {
        return ' '.repeat(indentation) + str.replace(/\n/g, '\n' + (' '.repeat(indentation)));
    };
}
