import 'jest';
import 'reflect-metadata';
import {f, PropertyValidator, PropertyValidatorError} from "@marcj/marshal";
import {bench} from "./util";
import {Boolean, Number as RuntypeNumber, Record, String as RuntypeString} from "runtypes";
import {jitValidate} from "@marcj/marshal/src/jit-validation";
import {validate} from "@marcj/marshal/src/validation-old";
import * as Ajv from 'ajv';

class IsNegative implements PropertyValidator {
    validate<T>(value: number) {
        if (value > 0) {
            return new PropertyValidatorError(
                'IsNegative',
                'Number must be negative.'
            );
        }
    }
}

function MinLengthFactory(minLength: number) {
    return class MinLength implements PropertyValidator {
        validate<T>(value: string) {
            if (value.length < minLength) {
                return new PropertyValidatorError(
                    'MinLength',
                    `String must have minimum length of ${minLength}.`
                );
            }
        }
    };
}

export const DATA = Object.freeze({
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vivendum intellegat et qui, ei denique consequuntur vix. Semper aeterno percipit ut his, sea ex utinam referrentur repudiandae. No epicuri hendrerit consetetur sit, sit dicta adipiscing ex, in facete detracto deterruisset duo. Quot populo ad qui. Sit fugit nostrum et. Ad per diam dicant interesset, lorem iusto sensibus ut sed. No dicam aperiam vis. Pri posse graeco definitiones cu, id eam populo quaestio adipiscing, usu quod malorum te. Ex nam agam veri, dicunt efficiantur ad qui, ad legere adversarium sit. Commune platonem mel id, brute adipiscing duo an. Vivendum intellegat et qui, ei denique consequuntur vix. Offendit eleifend moderatius ex vix, quem odio mazim et qui, purto expetendis cotidieque quo cu, veri persius vituperata ei nec. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    boolean: true,
    deeplyNested: {
        foo: 'bar',
        num: 1,
        bool: false,
    },
});

export type Data = typeof DATA;

type DeeplyNested = Data['deeplyNested'];

class DeeplyNestedType implements DeeplyNested {
    @f
    foo!: string;

    @f
    num!: number;

    @f
    bool!: boolean;
}

class MarshalModel implements Data {
    @f
    number!: number;

    @f.validator(IsNegative)
    negNumber!: number;

    @f
    maxNumber!: number;

    @f
    string!: string;

    @f.validator(MinLengthFactory(100))
    longString!: string;

    @f
    boolean!: boolean;

    @f.type(DeeplyNestedType)
    deeplyNested!: DeeplyNestedType;
}

const RuntypeModel = Record({
    number: RuntypeNumber,
    negNumber: RuntypeNumber.withConstraint(n => n < 0),
    maxNumber: RuntypeNumber,
    string: RuntypeString,
    longString: RuntypeString.withConstraint(s => s.length > 100),
    boolean: Boolean,
    deeplyNested: Record({
        foo: RuntypeString,
        num: RuntypeNumber,
        bool: Boolean,
    }),
});

test('benchmark validation', () => {
    const count = 100_000;

    bench(count, 'validation non-jit on plain', (i) => {
        const errors = validate(MarshalModel, DATA);
    });

    bench(count, 'validation jit on plain', (i) => {
        const errors = jitValidate(MarshalModel)(DATA);
    });

    bench(count, 'validation runtype', (i) => {
        const spaceObject = RuntypeModel.check(DATA);
    });

    {
        const schema = {
            "$id": "http://example.com/schemas/defs.json",
            "type": "object",
            "properties": {
                "number": {"type": "integer"},
                "negNumber": {"type": "integer", "maximum": 0},
                "maxNumber": {"type": "integer"},
                "string": {"type": "string"},
                "longString": {
                    "type": "string",
                    "minLength": 100
                },
                "boolean": {"type": "boolean"},
                "deeplyNested": {"$ref": "#/definitions/deeplyNested"},
            },
            "required": ["number", "negNumber", "maxNumber", "string", "longString", "boolean", "deeplyNested"],
            "definitions": {
                "deeplyNested": {
                    "type": "object",
                    "properties": {
                        "foo": {"type": "string"},
                        "num": {"type": "number"},
                        "bool": {"type": "boolean"}
                    },
                    "required": ["foo", "num", "bool"]
                }
            }
        };
        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        const valid = validate(DATA);
        expect(valid).toBe(true);

        bench(count, 'validation ajv', (i) => {
            const valid = validate(DATA);
        });
    }
});


test('benchmark freezed delete', () => {
    const data = ({...DATA}) as any;
    delete data.boolean;

    const errors = jitValidate(MarshalModel)(Object.freeze(data));
    expect(errors).toEqual([
        {code: 'required', message: 'Required value is undefined or null', path: 'boolean'}
    ]);
});


test('benchmark isArray', () => {
    const array = [];
    const count = 100_000;

    bench(count, 'Array.isArray', (i) => {
        let is = false;
        if (Array.isArray(array)) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    bench(count, 'a instanceof Array', (i) => {
        let is = false;
        if (array instanceof Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    bench(count, 'constructor === Array', (i) => {
        let is = false;
        if (array && array.constructor === Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    bench(count, '.length', (i) => {
        let is = false;
        if (array.length >= 0) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    bench(count, '.length && slice', (i) => {
        let is = false;
        if (array.length >= 0 && 'function' === typeof array.slice && 'string' !== typeof array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });
    bench(count, '!.length || !slice', (i) => {
        let is = true;
        if (array.length === undefined || 'string' === typeof array || 'function' !== typeof array.slice) {
            is = false;
        }
        if (!is) throw Error('invalid');
    });
});
