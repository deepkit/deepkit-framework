const { getDirname, getFilename } = require('../../dist/cjs/index.cjs');
const { expect } = require('chai');

describe('Node.js CJS', () => {
    it('getDirname() should return the same string as __dirname', function () {
        console.debug("\tgetDirname() \t->", getDirname());
        console.debug("\t__dirname \t->", __dirname);
        expect(getDirname()).to.equal(__dirname);
    });

    it('getFilename() should return the same string as __filename', function () {
        console.debug("\tgetFilename() \t->", getFilename());
        console.debug("\__filename \t->", __filename);
        expect(getFilename()).to.equal(__filename);
    });
});
