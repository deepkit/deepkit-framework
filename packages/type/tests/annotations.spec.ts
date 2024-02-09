import { test, expect } from '@jest/globals';
import { ExtractTypeAnnotationOptions, getAnnotationMeta, TypeAnnotation, TypeObjectLiteral } from '../src/reflection/type.js';
import { typeOf } from '../src/reflection/reflection.js';
import { expectEqualType } from './utils.js';

test('extract type annotation options', () => {
    type Skip = TypeAnnotation<'skip', { if: boolean }>;

    type SkipOptions = ExtractTypeAnnotationOptions<Skip>;

    const options: SkipOptions = {
        if: true,
    };
});


test('getAnnotationMeta', () => {
    type LevelOptions = { do: boolean };

    const levelOptionsType = typeOf<LevelOptions>();

    type Level = TypeAnnotation<'level', LevelOptions>;

    const levelType = typeOf<Level>() as TypeObjectLiteral;

    const meta = getAnnotationMeta(levelType);

    expect(meta).toBeDefined();

    expect(meta!.id).toBe('level');

    expectEqualType(meta!.params[0], levelOptionsType);

});
