import { createRequire } from "module";
import { dirname } from "path"
import { pathToFileURL } from "url";

export function resolve(assetName: string): string {
    const require = createRequire(pathToFileURL(__filename).toString());
    return dirname(require.resolve(assetName))
}
