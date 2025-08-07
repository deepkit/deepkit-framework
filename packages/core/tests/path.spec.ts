import { expect, test } from '@jest/globals';
import { pathBasename, pathDirectory, pathNormalize, pathNormalizeDirectory } from '../src/path.js';

test('pathNormalize', () => {
    expect(pathNormalize('')).toBe('/');
    expect(pathNormalize('/')).toBe('/');
    expect(pathNormalize('///')).toBe('/');
    expect(pathNormalize('///a/b/c/')).toBe('/a/b/c');
    expect(pathNormalize('/a/b/c/')).toBe('/a/b/c');
    expect(pathNormalize('a/b/c/')).toBe('/a/b/c');
    expect(pathNormalize('a//b/c/')).toBe('/a/b/c');
    expect(pathNormalize('a/b/c')).toBe('/a/b/c');
    expect(pathNormalize('/a/b/c//')).toBe('/a/b/c');
    expect(pathNormalize('/a/b/c///')).toBe('/a/b/c');
});

test('pathNormalizeDirectory', () => {
    expect(pathNormalizeDirectory('/')).toBe('/');
    expect(pathNormalizeDirectory('')).toBe('/');
    expect(pathNormalizeDirectory('///')).toBe('/');
    expect(pathNormalizeDirectory('///a/b/c/')).toBe('/a/b/c/');
    expect(pathNormalizeDirectory('/a/b/c/')).toBe('/a/b/c/');
    expect(pathNormalizeDirectory('a/b/c/')).toBe('/a/b/c/');
    expect(pathNormalizeDirectory('a//b/c/')).toBe('/a/b/c/');
    expect(pathNormalizeDirectory('a/b/c')).toBe('/a/b/c/');
    expect(pathNormalizeDirectory('/a/b/c///')).toBe('/a/b/c/');
});

test('pathDirectory', () => {
    expect(pathDirectory('/')).toBe('/');
    expect(pathDirectory('')).toBe('/');
    expect(pathDirectory('///')).toBe('/');
    expect(pathDirectory('///a/b/c/')).toBe('/a/b');
    expect(pathDirectory('/a/b/c/')).toBe('/a/b');
    expect(pathDirectory('a/b/c/')).toBe('/a/b');
    expect(pathDirectory('a//b/c/')).toBe('/a/b');
    expect(pathDirectory('a/b/c')).toBe('/a/b');
    expect(pathDirectory('/a/b/c///')).toBe('/a/b');
});

test('pathBasename', () => {
    expect(pathBasename('/')).toBe('');
    expect(pathBasename('')).toBe('');
    expect(pathBasename('///')).toBe('');
    expect(pathBasename('///a/b/c/')).toBe('c');
    expect(pathBasename('/a/b/c/')).toBe('c');
    expect(pathBasename('a/b/c/')).toBe('c');
    expect(pathBasename('a//b/c/')).toBe('c');
    expect(pathBasename('a/b/c')).toBe('c');
    expect(pathBasename('/a/b/c///')).toBe('c');
});
