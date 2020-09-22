import 'jest-extended';
import 'reflect-metadata';
import {DeepkitFile} from '../src/file';

test('file', () => {
    const files: DeepkitFile[] = [
        new DeepkitFile('root.txt'),
        new DeepkitFile('dir/text1.txt'),
        new DeepkitFile('dir/text2.txt'),
        new DeepkitFile('anotherone/text1.txt'),
    ];

    expect(files[0].getDirectory()).toBe('/');
    expect(files[0].inDirectory('/')).toBe(true);
    expect(files[0].inDirectory('/dir/')).toBe(false);
    expect(files[0].getName()).toBe('root.txt');
    expect(files[0].getFullPath()).toBe('/root.txt');

    expect(files[1].getDirectory()).toBe('/dir/');
    expect(files[1].inDirectory('/dir/')).toBe(true);
    expect(files[1].inDirectory('/dir')).toBe(false);
    expect(files[1].inDirectory('/')).toBe(false);
    expect(files[1].getName()).toBe('text1.txt');
    expect(files[1].getFullPath()).toBe('/dir/text1.txt');
});
