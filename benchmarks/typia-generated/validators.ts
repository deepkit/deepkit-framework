import * as __typia_transform__createStandardSchema from 'typia/lib/internal/_createStandardSchema.js';
import * as __typia_transform__validateReport from 'typia/lib/internal/_validateReport.js';

interface Model {
    number: number;
    negNumber: number;
    maxNumber: number;
    string: string;
    longString: string;
    boolean: boolean;
    deeplyNested: {
        foo: string;
        num: number;
        bool: boolean;
    };
}
// assertLoose - type guard (allow extra keys)
export const typiaIs = (() => {
    const _io0 = (input: any): boolean =>
        'number' === typeof input.number &&
        'number' === typeof input.negNumber &&
        'number' === typeof input.maxNumber &&
        'string' === typeof input.string &&
        'string' === typeof input.longString &&
        'boolean' === typeof input.boolean &&
        'object' === typeof input.deeplyNested &&
        null !== input.deeplyNested &&
        _io1(input.deeplyNested);
    const _io1 = (input: any): boolean =>
        'string' === typeof input.foo && 'number' === typeof input.num && 'boolean' === typeof input.bool;
    return (input: any): input is Model => 'object' === typeof input && null !== input && _io0(input);
})();
// assertStrict - type guard (reject extra keys)
export const typiaEquals = (() => {
    const _io0 = (input: any, _exceptionable: boolean = true): boolean =>
        'number' === typeof input.number &&
        'number' === typeof input.negNumber &&
        'number' === typeof input.maxNumber &&
        'string' === typeof input.string &&
        'string' === typeof input.longString &&
        'boolean' === typeof input.boolean &&
        'object' === typeof input.deeplyNested &&
        null !== input.deeplyNested &&
        _io1(input.deeplyNested, true && _exceptionable) &&
        (7 === Object.keys(input).length ||
            Object.keys(input).every((key: any) => {
                if (
                    ['number', 'negNumber', 'maxNumber', 'string', 'longString', 'boolean', 'deeplyNested'].some(
                        (prop: any) => key === prop,
                    )
                )
                    return true;
                const value = input[key];
                if (undefined === value) return true;
                return false;
            }));
    const _io1 = (input: any, _exceptionable: boolean = true): boolean =>
        'string' === typeof input.foo &&
        'number' === typeof input.num &&
        'boolean' === typeof input.bool &&
        (3 === Object.keys(input).length ||
            Object.keys(input).every((key: any) => {
                if (['foo', 'num', 'bool'].some((prop: any) => key === prop)) return true;
                const value = input[key];
                if (undefined === value) return true;
                return false;
            }));
    return (input: any, _exceptionable: boolean = true): input is Model =>
        'object' === typeof input && null !== input && _io0(input, true);
})();
// For parseSafe - clone the object
export const typiaClone = (() => {
    const _co0 = (input: any): any => ({
        number: input.number,
        negNumber: input.negNumber,
        maxNumber: input.maxNumber,
        string: input.string,
        longString: input.longString,
        boolean: input.boolean,
        deeplyNested: _co1(input.deeplyNested) as any,
    });
    const _co1 = (input: any): any => ({
        foo: input.foo,
        num: input.num,
        bool: input.bool,
    });
    const _io1 = (input: any): boolean =>
        'string' === typeof input.foo && 'number' === typeof input.num && 'boolean' === typeof input.bool;
    return (input: Model): import('typia').Resolved<Model> => _co0(input) as any;
})();
// Alternative: validate and return
export const typiaValidate = (() => {
    const _io0 = (input: any): boolean =>
        'number' === typeof input.number &&
        'number' === typeof input.negNumber &&
        'number' === typeof input.maxNumber &&
        'string' === typeof input.string &&
        'string' === typeof input.longString &&
        'boolean' === typeof input.boolean &&
        'object' === typeof input.deeplyNested &&
        null !== input.deeplyNested &&
        _io1(input.deeplyNested);
    const _io1 = (input: any): boolean =>
        'string' === typeof input.foo && 'number' === typeof input.num && 'boolean' === typeof input.bool;
    const _vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
        [
            'number' === typeof input.number ||
                _report(_exceptionable, {
                    path: _path + '.number',
                    expected: 'number',
                    value: input.number,
                }),
            'number' === typeof input.negNumber ||
                _report(_exceptionable, {
                    path: _path + '.negNumber',
                    expected: 'number',
                    value: input.negNumber,
                }),
            'number' === typeof input.maxNumber ||
                _report(_exceptionable, {
                    path: _path + '.maxNumber',
                    expected: 'number',
                    value: input.maxNumber,
                }),
            'string' === typeof input.string ||
                _report(_exceptionable, {
                    path: _path + '.string',
                    expected: 'string',
                    value: input.string,
                }),
            'string' === typeof input.longString ||
                _report(_exceptionable, {
                    path: _path + '.longString',
                    expected: 'string',
                    value: input.longString,
                }),
            'boolean' === typeof input.boolean ||
                _report(_exceptionable, {
                    path: _path + '.boolean',
                    expected: 'boolean',
                    value: input.boolean,
                }),
            ((('object' === typeof input.deeplyNested && null !== input.deeplyNested) ||
                _report(_exceptionable, {
                    path: _path + '.deeplyNested',
                    expected: '__type',
                    value: input.deeplyNested,
                })) &&
                _vo1(input.deeplyNested, _path + '.deeplyNested', true && _exceptionable)) ||
                _report(_exceptionable, {
                    path: _path + '.deeplyNested',
                    expected: '__type',
                    value: input.deeplyNested,
                }),
        ].every((flag: boolean) => flag);
    const _vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
        [
            'string' === typeof input.foo ||
                _report(_exceptionable, {
                    path: _path + '.foo',
                    expected: 'string',
                    value: input.foo,
                }),
            'number' === typeof input.num ||
                _report(_exceptionable, {
                    path: _path + '.num',
                    expected: 'number',
                    value: input.num,
                }),
            'boolean' === typeof input.bool ||
                _report(_exceptionable, {
                    path: _path + '.bool',
                    expected: 'boolean',
                    value: input.bool,
                }),
        ].every((flag: boolean) => flag);
    const __is = (input: any): input is Model => 'object' === typeof input && null !== input && _io0(input);
    let errors: any;
    let _report: any;
    return __typia_transform__createStandardSchema._createStandardSchema(
        (input: any): import('typia').IValidation<Model> => {
            if (false === __is(input)) {
                errors = [];
                _report = (__typia_transform__validateReport._validateReport as any)(errors);
                ((input: any, _path: string, _exceptionable: boolean = true) =>
                    ((('object' === typeof input && null !== input) ||
                        _report(true, {
                            path: _path + '',
                            expected: 'Model',
                            value: input,
                        })) &&
                        _vo0(input, _path + '', true)) ||
                    _report(true, {
                        path: _path + '',
                        expected: 'Model',
                        value: input,
                    }))(input, '$input', true);
                const success = 0 === errors.length;
                return success
                    ? {
                          success,
                          data: input,
                      }
                    : ({
                          success,
                          errors,
                          data: input,
                      } as any);
            }
            return {
                success: true,
                data: input,
            } as any;
        },
    );
})();
