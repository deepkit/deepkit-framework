/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

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
