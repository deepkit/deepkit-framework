/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { good } from './validation.js';
import Ajv from 'ajv';
import { BenchSuite } from '../../bench.js';

//todo: note deeplyNested is missing, so not complete validation yet.

const schema = {
    "$id": "http://example.com/schemas/defs.json",
    "type": "object",
    "properties": {
        "number": { "type": "integer" },
        "negNumber": { "type": "integer", "maximum": 0 },
        "maxNumber": { "type": "integer", "maximum": 550 },
        "strings": { "type": "array", "items": { "type": "string" } },
        "longString": { "type": "string" },
        "boolean": { "type": "boolean" },
        "deeplyNested": {
            "type": "object",
            "properties": {
                "foo": { "type": "string" },
                "num": { "type": "integer" },
                "bool": { "type": "boolean" },
            },
            "required": ["foo", "num", "bool"],
        },
    },
    "required": ["number", "negNumber", "maxNumber", "strings", "longString", "boolean", "deeplyNested"],
};
const ajv = new Ajv();
const validate = ajv.compile(schema);

export async function main() {
    const suite = new BenchSuite('avj');

    // console.log('validate', validate.toString());
    // console.log('validate(good)', validate(good));

    if (!validate(good)) throw new Error('Should be valid');

    suite.add('validate', () => {
        validate(good);
    });

    suite.run();
}
