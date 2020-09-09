export let moment: any = () => {
    throw new Error('Moment.js not installed');
};

declare function require(moduleName: string): any;

try {
    moment = require('moment');
} catch (e) {
}

export function getMoment() {
    return moment;
}