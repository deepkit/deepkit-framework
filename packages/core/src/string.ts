/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/** @group String */

export function indent(indentation: number, prefix: string = '') {
    return (str: string = '') => {
        return ' '.repeat(indentation) + str.replace(/\n/g, '\n' + (' '.repeat(indentation)) + prefix);
    };
}

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1)
}
