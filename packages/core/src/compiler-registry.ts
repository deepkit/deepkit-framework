import {Types} from "./decorators";
import {TypeConverterCompiler} from "./jit";

export const compilerRegistry = new Map<string, TypeConverterCompiler>();

/**
 * Registers a new compiler function for a certain type in certain direction
 * (plain to class, class to plain for example).
 *
 * Note: Don't use isArray/isMap/isPartial at `property` as those are already handled before your compiler code
 * is called. Focus on marshalling the given type as fast and clear as possible. Note that when you come
 * from `class` to x property values are guaranteed to have certain value types since the TS system enforces it.
 * If a user overwrites with `as any` its not our business to convert them implicitly.
 *
 * WARNING: However, coming from `plain` to `x` the property values usually come from user input which makes
 * it necessary to check the type and convert it if necessary. This is extremely important to not
 * introduce security issues.
 *
 * Note: Context is shared across types, so make either your usage unique or work around it.
 * Don't store `property` specific values into it, since it's shared and would be overwritten/invalid.
 */
export function registerConverterCompiler(
    fromFormat: string,
    toFormat: string,
    type: Types,
    compiler: TypeConverterCompiler
) {
    compilerRegistry.set(fromFormat + ':' + toFormat + ':' + type, compiler);
}
