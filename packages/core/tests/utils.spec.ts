import 'jest-extended';
import 'reflect-metadata';
import { isArray, isObject, isUndefined } from '..';

class SimpleClass {
  public label: string;

  constructor(label: string) {
    this.label = label;
  }
}

test('helper is Object', () => {
  expect(isObject([])).toBeFalse();
  expect(isObject(false)).toBeFalse();
  expect(isObject(true)).toBeFalse();
  expect(isObject(null)).toBeFalse();
  expect(isObject(undefined)).toBeFalse();
  expect(isObject(1)).toBeFalse();
  expect(isObject('1')).toBeFalse();

  expect(isObject({})).toBeTrue();
  expect(isObject(new Date())).toBeTrue();
  expect(isObject(new SimpleClass('asd'))).toBeTrue();
});

test('helper is array', () => {
  expect(isArray({})).toBeFalse();
  expect(isArray(new Date())).toBeFalse();
  expect(isArray(new SimpleClass('asd'))).toBeFalse();
  expect(isArray(false)).toBeFalse();
  expect(isArray(true)).toBeFalse();
  expect(isArray(null)).toBeFalse();
  expect(isArray(undefined)).toBeFalse();
  expect(isArray(1)).toBeFalse();
  expect(isArray('1')).toBeFalse();

  expect(isArray([])).toBeTrue();
});

test('helper is isUndefined', () => {
  expect(isUndefined({})).toBeFalse();
  expect(isUndefined(new Date())).toBeFalse();
  expect(isUndefined(new SimpleClass('asd'))).toBeFalse();
  expect(isUndefined(false)).toBeFalse();
  expect(isUndefined(true)).toBeFalse();
  expect(isUndefined(null)).toBeFalse();
  expect(isUndefined(1)).toBeFalse();
  expect(isUndefined('1')).toBeFalse();
  expect(isUndefined([])).toBeFalse();

  expect(isUndefined(undefined)).toBeTrue();
});
