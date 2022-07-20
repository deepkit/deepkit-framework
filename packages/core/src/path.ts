const DIRNAME_POSIX_REGEX = /^((?:\.(?![^\/]))|(?:(?:\/?|)(?:[\s\S]*?)))(?:\/+?|)(?:(?:\.{1,2}|[^\/]+?|)(?:\.[^.\/]*|))(?:[\/]*)$/;
const DIRNAME_WIN32_REGEX = /^((?:\.(?![^\\]))|(?:(?:\\?|)(?:[\s\S]*?)))(?:\\+?|)(?:(?:\.{1,2}|[^\\]+?|)(?:\.[^.\\]*|))(?:[\\]*)$/;

/**
 * Replacement for path.dirname from Node.js
 * @param path The full path you want to get the dirname from
 * @returns The dirname of the path
 */
export const dirname = (path: string) => {
  
    let dirname = DIRNAME_POSIX_REGEX.exec(path)?.[1];
  
    if (!dirname) {
      dirname = DIRNAME_WIN32_REGEX.exec(path)?.[1];
    }
  
    if(!dirname) {
      throw new Error(`Can't extract dirname from ${path}`);
    }
  
    return dirname;
  }