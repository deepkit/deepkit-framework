import { expect, test } from '@jest/globals';
import { parseJSDocAttributeFromText } from '../src/reflection-ast.js';

test('parse js doc attribute', () => {
    expect(parseJSDocAttributeFromText(`/**
    * @attr attr
    */`, 'attr')).toBe('attr');

    expect(parseJSDocAttributeFromText(`/**
    * @attr attr
    */`, 'attr2')).toBeUndefined();

    expect(parseJSDocAttributeFromText(`/**
    * @attr2 attr2-content
    * @attr attr-content
    */`, 'attr')).toBe('attr-content');

    expect(parseJSDocAttributeFromText(`/**
    * @attr
    */`, 'attr')).toBe('');

    expect(parseJSDocAttributeFromText(`/**
    * @attr2 attr2-content
    * @attr
    */`, 'attr')).toBe('');
});
