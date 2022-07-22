import { dirname as pathDirname, fromFileUrl } from "https://deno.land/std/path/mod.ts";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { getDirname, getFilename } from '../../mod.ts';

export const esmFilename = () => {
    const __filename = fromFileUrl(import.meta.url);
    return __filename;
};

export const esmDirname = () => {
    return pathDirname(esmFilename());
};

Deno.test("Deno getDirname", () => {
    const crossDirname = getDirname();
    const _esmDirname = esmDirname();
    
    console.log("Deno");
    console.log(`\tgetDirname() \t-> "${crossDirname}"`);
    console.log(`\tesmDirname() \t-> "${_esmDirname}"`);
    assertEquals(crossDirname, _esmDirname);
});

Deno.test("Deno getFilename", () => {
    const crossFilename = getFilename();
    const _esmFilename = esmFilename();
    
    console.log("Deno");
    console.log(`\tgetFilename() \t-> "${crossFilename}"`);
    console.log(`\tesmFilename() \t-> "${_esmFilename}"`);
    assertEquals(crossFilename, _esmFilename);
});