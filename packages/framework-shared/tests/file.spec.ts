import 'jest-extended';
import 'reflect-metadata';
import {HornetFile} from '../src/file';

test('file', () => {
    const files: HornetFile[] = [
        new HornetFile('root.txt'),
        new HornetFile('dir/text1.txt'),
        new HornetFile('dir/text2.txt'),
        new HornetFile('anotherone/text1.txt'),
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
