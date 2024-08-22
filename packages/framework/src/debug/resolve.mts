import { dirname } from "path"

export function resolve(assetName: string): string {
    // @ts-ignore
    const assetUrl = import.meta.resolve(assetName)

    if (!assetUrl.startsWith('file://')) {
        throw new Error('Invalid local URL')
    }

    return dirname(assetUrl.substring('file://'.length))
}
