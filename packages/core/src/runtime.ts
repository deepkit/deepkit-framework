import { dirname as _dirname} from "path";
import { platform } from 'os';

/**
 * CJS and ESM compatible implementation for __dirname
 * @returns What `__dirname` would return in CJS
 * @see https://github.com/vdegenne/es-dirname/blob/master/es-dirname.js
 */
export const getDirname = () => {
    let dirname = '';
    try {
        // @ts-ignore
        ShadowsAlwaysDieTwice
    } catch (e: any) {
        const initiator = e.stack.split('\n').slice(2, 3)[0]
        let path = /(?<path>[^\(\s]+):[0-9]+:[0-9]+/.exec(initiator)?.groups?.path
    
        if(!path) {
            throw new Error("Can't get __dirname!");
        }
    
        if (path.indexOf('file') >= 0) {
          path = new URL(path).pathname
        }
        dirname = _dirname(path)
        if (dirname[0] === '/' && platform() === 'win32') {
          dirname = dirname.slice(1)
        }
    }
    return dirname
}