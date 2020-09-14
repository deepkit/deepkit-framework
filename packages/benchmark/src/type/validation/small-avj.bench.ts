import {BenchSuite} from '@deepkit/core';
import {good} from './validation';
import Ajv from 'ajv';

//todo: note deeplyNested is missing, so not complete validation yet.

const schema = {
    "$id": "http://example.com/schemas/defs.json",
    "type": "object",
    "properties": {
        "number": {"type": "integer"},
        "negNumber": {"type": "integer", "maximum": 0},
        "maxNumber": {"type": "integer"},
        "strings": {"type": "array", "items": { "type": "string" }},
        "longString": {
            "type": "string",
            "minLength": 100
        },
        "boolean": {"type": "boolean"},
    },
    "required": ["number", "negNumber", "maxNumber", "strings", "longString", "boolean"],
};
const ajv = new Ajv();
const validate = ajv.compile(schema);

export async function main() {
    const suite = new BenchSuite('avj');

    suite.add('validate', () => {
        validate(good);
    });

    suite.run();
}
