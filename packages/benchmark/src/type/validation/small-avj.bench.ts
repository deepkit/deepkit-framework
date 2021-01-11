/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { good } from './validation';
import Ajv from 'ajv';
import { BenchSuite } from '../../bench';

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
