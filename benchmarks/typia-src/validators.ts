/**
 * Typia validators for benchmark comparison.
 * These get compiled by typia generate to produce optimized runtime code.
 */
import typia from 'typia';

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
export const typiaIs = typia.createIs<Model>();

// assertStrict - type guard (reject extra keys)
export const typiaEquals = typia.createEquals<Model>();

// For parseSafe - clone the object
export const typiaClone = typia.misc.createClone<Model>();

// Alternative: validate and return
export const typiaValidate = typia.createValidate<Model>();
