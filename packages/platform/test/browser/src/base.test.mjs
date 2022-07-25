import { getDirname, getFilename } from '../../../dist/esm/index.js';
import { expect } from 'chai';

describe('Browser ESM', () => {
    it('getDirname() should be a string', function () {
        console.debug("\tgetDirname() \t->", getDirname());
        expect(getDirname()).to.be.a("string");
    });

    it('getFilename() should be a string', function () {
        console.debug("\tgetFilename() \t->", getFilename());
        expect(getFilename()).to.be.a("string");
    });

    it('getFilename() should end with "base.test.js"', function () {
        expect(getFilename().endsWith('base.test.js')).to.be.true;
    });

});
