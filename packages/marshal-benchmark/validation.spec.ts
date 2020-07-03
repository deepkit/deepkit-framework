import 'jest';
import 'reflect-metadata';
import {f, PropertyValidator, PropertyValidatorError} from "@marcj/marshal";
import {bench} from "./util";
import {jitValidate} from "@marcj/marshal/src/jit-validation";
import * as Ajv from 'ajv';

//we use `e` and not `v` because Marshal supports out of the box error explanations, which quartet does only with `e`.
import { e } from 'quartet';

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
    strings: ['string1', 'string2'],
    longString:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vivendum intellegat et qui, ei denique consequuntur vix. Semper aeterno percipit ut his, sea ex utinam referrentur repudiandae. No epicuri hendrerit consetetur sit, sit dicta adipiscing ex, in facete detracto deterruisset duo. Quot populo ad qui. Sit fugit nostrum et. Ad per diam dicant interesset, lorem iusto sensibus ut sed. No dicam aperiam vis. Pri posse graeco definitiones cu, id eam populo quaestio adipiscing, usu quod malorum te. Ex nam agam veri, dicunt efficiantur ad qui, ad legere adversarium sit. Commune platonem mel id, brute adipiscing duo an. Vivendum intellegat et qui, ei denique consequuntur vix. Offendit eleifend moderatius ex vix, quem odio mazim et qui, purto expetendis cotidieque quo cu, veri persius vituperata ei nec. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    boolean: true,
});

export type Data = typeof DATA;


class MarshalModel implements Data {
    @f
    number!: number;

    @f.validator(IsNegative)
    negNumber!: number;

    @f
    maxNumber!: number;

    @f.array(String)
    strings!: string[];

    @f.validator(MinLengthFactory(100))
    longString!: string;

    @f
    boolean!: boolean;
}

const QuartetModelChecker = e<MarshalModel>({
    number: e.number,
    negNumber: e.and(e.number, e.negative),
    maxNumber: e.number,
    strings: e.arrayOf(e.string),
    longString: e.and(e.string, e.minLength(100)),
    boolean: e.boolean,
});

const MarshalModelValidation = jitValidate(MarshalModel);

test('benchmark validation', () => {
    const count = 100_000;

    bench(count, 'validation Marshal', (i) => {
        const errors = MarshalModelValidation(DATA);
    });

    {
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
        const valid = validate(DATA);
        expect(valid).toBe(true);

        bench(count, 'validation ajv', (i) => {
            const valid = validate(DATA);
        });
    }

    bench(count, 'validation quartet', (i) => {
        const valid = QuartetModelChecker(DATA);
    });
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
