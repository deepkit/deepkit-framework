import { getDirname, getFilename } from '../../dist/esm/index.mjs';
import { fileURLToPath } from "url";
import { dirname as pathDirname } from "path";
import { expect } from 'chai';

export const esmFilename = () => {
    const __filename = fileURLToPath(import.meta.url);
    return __filename;
};

export const esmDirname = () => {
    return pathDirname(esmFilename());
};

describe('Node.js ESM', () => {
    it('getDirname() should return the same string as esmDirname', function () {
        console.debug("\tgetDirname() \t->", getDirname());
        console.debug("\tesmDirname() \t->", esmDirname());
        expect(getDirname()).to.equal(esmDirname(import.meta));
    });

    it('getFilename() should return the same string as esmFilename', function () {
        console.debug("\tgetFilename() \t->", getFilename());
        console.debug("\tesmFilename() \t->", esmFilename());
        expect(getFilename()).to.equal(esmFilename(import.meta));
    });
});
