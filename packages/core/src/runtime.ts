import { dirname as pathDirname } from './path.js';

const EXTRACT_PATH_REGEX = /(?<path>[^\(\s]+):[0-9]+:[0-9]+/;
const WIN_POSIX_DRIVE_REGEX = /^\/[A-Z]:\/*/;

/**
 * CJS and ESM compatible implementation for __dirname.
 * 
 * Works on
 * * Node.js + Windows / Linux / MacOS + ESM / CJS
 * 
 * Contributions for other environments like GJS or Deno are welcome
 * 
 * @returns What `__dirname` would return in CJS
 * @see https://github.com/vdegenne/es-dirname/blob/master/es-dirname.js
 */
export const getDirname = () => {
  let dirname = '';
  try {
    throw new Error();
  } catch (e: any) {
    const initiator = e.stack.split('\n').slice(2, 3)[0]

    let path = EXTRACT_PATH_REGEX.exec(initiator)?.groups?.path

    if(!path) {
      throw new Error("Can't get __dirname!");
    }

    const protocol = "file://";
    if (path.indexOf(protocol) >= 0) {
      path = path.slice(protocol.length);
    }

    if (WIN_POSIX_DRIVE_REGEX.test(path)) {
      path = path.slice(1).replace(/\//g, '\\');
    }

    dirname = pathDirname(path)

  }
  return dirname
}