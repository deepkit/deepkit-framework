/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Builder, Ref } from '@deepkit/core';

import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeEnum,
    TypeLiteral,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeUnion,
    getEnumValueIndexMatcher,
    isGlobalTypeClass,
    isPropertyMemberType,
    memberNameToString,
    resolveTypeMembers,
} from '../reflection/type.js';
import { embeddedAnnotation } from '../type-annotations.js';
import type { TypeHandler } from './registry.js';
import type { JsonBuildContext } from './state.js';
import {
    DiscriminatorInfo,
    UNION_LITERAL_THRESHOLD,
    detectDiscriminator,
    isAllLiterals,
    isUnionPrimitive,
} from './union-utils.js';

/**
 * Build a discriminated union handler (O(1) lookup).
 */
function buildDiscriminatedUnion(
    type: TypeUnion,
    disc: DiscriminatorInfo,
    input: Ref,
    b: Builder,
    state: JsonBuildContext,
): Ref {
    const discValue = input.get(disc.property);
    const result = b.var_<any>(undefined);
    const matched = b.var_(false);

    const cases: Array<[any, () => void]> = [];

    for (const [literal, memberType] of disc.valueToMember) {
        cases.push([
            literal,
            () => {
                // Build the full object for this member
                const memberResult = state.build(memberType, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            },
        ]);
    }

    b.switch_(discValue, cases, () => {
        state.throw_(type, input, `Unknown discriminator value for '${disc.property}'`);
    });

    return b.getVar(result);
}

/**
 * Build a literal union handler using Set.has() (O(1) lookup).
 */
function buildLiteralSetUnion(type: TypeUnion, input: Ref, b: Builder, state: JsonBuildContext): Ref {
    const literals = type.types.map(t => (t as TypeLiteral).literal);
    const literalSet = new Set(literals);

    // Check if input is in the set
    const hasCheck = b.call((set: Set<any>, value: any) => set.has(value), b.lit(literalSet), input);

    b.if_(b.not(hasCheck), () => {
        state.throw_(type, input, 'Value not in union');
    });

    return input;
}

/**
 * Get a type check expression for a primitive member.
 */
function getPrimitiveTypeCheck(member: Type, input: Ref, b: Builder, loose: boolean = false): Ref<boolean> | undefined {
    switch (member.kind) {
        case ReflectionKind.string:
            if (loose) {
                // In loose mode, accept any primitive that can be converted to string
                // (string, number, boolean, bigint)
                return b.or(
                    b.isType(input, 'string'),
                    b.or(b.isType(input, 'number'), b.or(b.isType(input, 'boolean'), b.isType(input, 'bigint'))),
                );
            }
            return b.isType(input, 'string');
        case ReflectionKind.number:
            if (loose) {
                // Accept strings that look like numbers
                return b.or(
                    b.isType(input, 'number'),
                    b.and(
                        b.isType(input, 'string'),
                        b.call((s: string) => !isNaN(Number(s)), input),
                    ),
                );
            }
            return b.isType(input, 'number');
        case ReflectionKind.boolean:
            if (loose) {
                return b.or(
                    b.isType(input, 'boolean'),
                    b.or(
                        b.eq(input, b.lit(0)),
                        b.or(
                            b.eq(input, b.lit(1)),
                            b.or(
                                b.eq(input, b.lit('0')),
                                b.or(
                                    b.eq(input, b.lit('1')),
                                    b.or(b.eq(input, b.lit('true')), b.eq(input, b.lit('false'))),
                                ),
                            ),
                        ),
                    ),
                );
            }
            return b.isType(input, 'boolean');
        case ReflectionKind.bigint:
            if (loose) {
                // Accept bigint, numbers, and numeric strings
                return b.or(
                    b.isType(input, 'bigint'),
                    b.or(
                        b.isType(input, 'number'),
                        b.and(
                            b.isType(input, 'string'),
                            b.call((s: string) => /^-?\d+$/.test(s), input),
                        ),
                    ),
                );
            }
            return b.isType(input, 'bigint');
        case ReflectionKind.null:
            // Accept both null and undefined as null (JSON serialization convention)
            return b.isNullish(input);
        case ReflectionKind.undefined:
            // Accept both undefined and null as undefined (JSON serialization convention)
            return b.isNullish(input);
        case ReflectionKind.literal:
            const lit = (member as TypeLiteral).literal;
            if (loose) {
                if (typeof lit === 'number') {
                    // In loose mode, accept non-empty strings that convert to the same number
                    // Empty string converts to 0 but shouldn't match number literal 0
                    const isNonEmptyNumericString = b.and(
                        b.isType(input, 'string'),
                        b.and(
                            b.neq(input, b.lit('')), // Exclude empty string
                            b.eq(b.call(Number, input), b.lit(lit)),
                        ),
                    );
                    return b.or(b.eq(input, b.lit(lit)), isNonEmptyNumericString);
                }
                if (typeof lit === 'string') {
                    // In loose mode, accept numbers that convert to the same string
                    return b.or(b.eq(input, b.lit(lit)), b.eq(b.call(String, input), b.lit(lit)));
                }
            }
            return b.eq(input, b.lit(lit));
        default:
            return undefined;
    }
}

/**
 * Build a scored union handler (O(n) with validation fallthrough).
 *
 * Order of matching:
 * 1. Exact type matches (bigint for bigint, string for non-convertible strings)
 * 2. More specific conversions (numeric strings to bigint/number if available)
 * 3. Less specific matches (string fallback for any value that can be stringified)
 * 4. Object/class type matching
 */
function buildScoredUnion(type: TypeUnion, input: Ref, b: Builder, state: JsonBuildContext): Ref {
    const result = b.var_<any>(undefined);
    const matched = b.var_(false);

    // Check loose mode (options.loosely !== false)
    // optionsRef is already guaranteed to be an object via nullish coalescing in the caller
    const isLoose = b.neq(state.optionsRef.get('loosely'), b.lit(false));

    // Sort members: put more specific types first (bigint/number before string)
    // For literals, priority matches their base type (number literal = number, string literal = string)
    const sortedMembers = [...type.types].sort((a, c) => {
        const priority = (m: Type): number => {
            if (m.kind === ReflectionKind.bigint) return 0;
            if (m.kind === ReflectionKind.number) return 1;
            if (m.kind === ReflectionKind.boolean) return 2;
            if (m.kind === ReflectionKind.string) return 10; // String is a fallback
            // For literals, use the type of the literal value
            if (m.kind === ReflectionKind.literal) {
                const lit = (m as TypeLiteral).literal;
                if (typeof lit === 'bigint') return 0;
                if (typeof lit === 'number') return 1;
                if (typeof lit === 'boolean') return 2;
                if (typeof lit === 'string') return 10;
            }
            return 5;
        };
        return priority(a) - priority(c);
    });

    // Loose mode only applies to deserialization, not serialization
    const isDeserialize = state.direction === 'deserialize';
    const canUseLoose = isDeserialize ? isLoose : b.lit(false);

    // Pre-pass: Handle Date members specially before primitives
    // Date should match before string for ISO date strings
    const dateMembers = sortedMembers.filter(
        m => m.kind === ReflectionKind.class && (m as TypeClass).classType === Date,
    );
    if (dateMembers.length > 0) {
        const dateMember = dateMembers[0];
        b.if_(b.not(b.getVar(matched)), () => {
            // Check for Date instance first
            b.if_(b.isInstance(input, Date), () => {
                const memberResult = state.build(dateMember, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
        // Check for ISO date string (e.g. '2021-11-24T16:21:13.425Z')
        // ISO dates have 'T' in them and end with 'Z' or have timezone offset
        const isISODateString = (s: string) => {
            if (typeof s !== 'string') return false;
            // Quick check for ISO format: must contain 'T' and be a valid date
            if (!s.includes('T')) return false;
            const d = new Date(s);
            return !isNaN(d.getTime());
        };
        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.isType(input, 'string'), () => {
                b.if_(b.call(isISODateString, input), () => {
                    const memberResult = state.build(dateMember, input);
                    b.setVar(result, memberResult);
                    b.setVar(matched, b.lit(true));
                });
            });
        });
        // Check for numeric timestamp
        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.isType(input, 'number'), () => {
                const memberResult = state.build(dateMember, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
    }

    // Pre-pass: Handle RegExp members specially before string
    // RegExp strings look like "/pattern/flags" - we need to match these before string
    const regexpMembersPrepass = sortedMembers.filter(m => m.kind === ReflectionKind.regexp);
    const hasString = sortedMembers.some(m => m.kind === ReflectionKind.string);
    if (regexpMembersPrepass.length > 0 && hasString && isDeserialize) {
        const regexpMember = regexpMembersPrepass[0];
        b.if_(b.not(b.getVar(matched)), () => {
            // Check for RegExp instance first
            b.if_(b.isInstance(input, RegExp), () => {
                const memberResult = state.build(regexpMember, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
        // Check for serialized RegExp string (e.g. '/pattern/flags')
        const isRegExpString = (s: string) => {
            if (typeof s !== 'string') return false;
            if (!s.startsWith('/') || s.length < 2) return false;
            // Find the last '/' that has only valid flags after it (or nothing)
            const lastSlash = s.lastIndexOf('/');
            if (lastSlash <= 0) return false;
            const flags = s.slice(lastSlash + 1);
            return /^[gimsuy]*$/.test(flags);
        };
        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.isType(input, 'string'), () => {
                b.if_(b.call(isRegExpString, input), () => {
                    const memberResult = state.build(regexpMember, input);
                    b.setVar(result, memberResult);
                    b.setVar(matched, b.lit(true));
                });
            });
        });
    }

    // Pre-pass for single-property embedded types
    // These can be deserialized from a raw value matching the property type
    // Must run before primitive checks to take precedence over loose string matching
    if (isDeserialize) {
        for (const member of sortedMembers) {
            if (member.kind !== ReflectionKind.class && member.kind !== ReflectionKind.objectLiteral) continue;

            const embedded = embeddedAnnotation.getFirst(member);
            if (!embedded) continue;

            const memberType = member as TypeClass | TypeObjectLiteral;
            const embeddedMembers = resolveTypeMembers(memberType);
            const properties = embeddedMembers.filter(isPropertyMemberType) as (TypeProperty | TypePropertySignature)[];

            // Only handle single-property embedded types
            // When used directly (not as property of another type), prefix doesn't matter
            if (properties.length !== 1) continue;

            const prop = properties[0];
            const propType = prop.type;

            // Check if input matches the property's type
            b.if_(b.not(b.getVar(matched)), () => {
                let typeCheck: Ref<boolean> | undefined;

                // Generate type check based on the property's type
                if (propType.kind === ReflectionKind.number) {
                    typeCheck = b.isType(input, 'number');
                } else if (propType.kind === ReflectionKind.string) {
                    typeCheck = b.isType(input, 'string');
                } else if (propType.kind === ReflectionKind.boolean) {
                    typeCheck = b.isType(input, 'boolean');
                } else if (propType.kind === ReflectionKind.bigint) {
                    typeCheck = b.isType(input, 'bigint');
                }

                // Check for undefined explicitly since Exec mode may return false (raw boolean)
                if (typeCheck !== undefined) {
                    b.if_(typeCheck, () => {
                        const memberResult = state.build(member, input);
                        b.setVar(result, memberResult);
                        b.setVar(matched, b.lit(true));
                    });
                }
            });
        }
    }

    // Check if union contains both bigint and number (special case)
    const hasBigint = sortedMembers.some(m => m.kind === ReflectionKind.bigint);
    const hasNumber = sortedMembers.some(m => m.kind === ReflectionKind.number);
    const hasBigintAndNumber = hasBigint && hasNumber;

    // First pass: try exact type matches for all primitives
    // For numeric and boolean types in loose deserialize mode, use loose matching
    // EXCEPT: when union has both bigint and number, use exact match for bigint
    // This ensures numeric strings like '3' match number, and 'true'/'1' match boolean, before matching string
    for (const member of sortedMembers) {
        if (!isUnionPrimitive(member)) continue;

        b.if_(b.not(b.getVar(matched)), () => {
            // Check if this is a numeric type, numeric literal, or boolean
            const isNumericOrBooleanType =
                member.kind === ReflectionKind.number ||
                member.kind === ReflectionKind.bigint ||
                member.kind === ReflectionKind.boolean ||
                (member.kind === ReflectionKind.literal &&
                    (typeof (member as TypeLiteral).literal === 'number' ||
                        typeof (member as TypeLiteral).literal === 'bigint' ||
                        typeof (member as TypeLiteral).literal === 'boolean'));

            // Special case: when union has both bigint and number, bigint should accept
            // bigint and numeric strings, but NOT numbers (let number handle those)
            if (hasBigintAndNumber && member.kind === ReflectionKind.bigint && isDeserialize) {
                // Custom check: bigint or numeric string (not number)
                const bigintOrStringCheck = b.or(
                    b.isType(input, 'bigint'),
                    b.and(
                        b.isType(input, 'string'),
                        b.call((s: string) => /^-?\d+$/.test(s), input),
                    ),
                );
                const checkExpr = b.ternary(canUseLoose, bigintOrStringCheck, b.isType(input, 'bigint'));
                b.if_(checkExpr, () => {
                    const memberResult = state.build(member, input);
                    b.setVar(result, memberResult);
                    b.setVar(matched, b.lit(true));
                });
            } else if (isNumericOrBooleanType && isDeserialize) {
                // In loose mode, use loose check; in strict mode, use exact check
                const looseCheck = getPrimitiveTypeCheck(member, input, b, true);
                const exactCheck = getPrimitiveTypeCheck(member, input, b, false);
                // Check for undefined explicitly since Exec mode may return false (raw boolean)
                if (looseCheck !== undefined && exactCheck !== undefined) {
                    const checkExpr = b.ternary(canUseLoose, looseCheck, exactCheck);
                    b.if_(checkExpr, () => {
                        const memberResult = state.build(member, input);
                        b.setVar(result, memberResult);
                        b.setVar(matched, b.lit(true));
                    });
                }
            } else {
                const checkExpr = getPrimitiveTypeCheck(member, input, b, false);
                // Check for undefined explicitly since Exec mode may return false (raw boolean)
                if (checkExpr !== undefined) {
                    b.if_(checkExpr, () => {
                        const memberResult = state.build(member, input);
                        b.setVar(result, memberResult);
                        b.setVar(matched, b.lit(true));
                    });
                }
            }
        });
    }

    // Second pass: try loose conversions for string type (only if loosely mode is enabled and deserializing)
    b.if_(canUseLoose, () => {
        for (const member of sortedMembers) {
            if (!isUnionPrimitive(member)) continue;

            // Skip numeric and boolean types - they were already handled with loose matching in first pass
            const isNumericOrBooleanType =
                member.kind === ReflectionKind.number ||
                member.kind === ReflectionKind.bigint ||
                member.kind === ReflectionKind.boolean ||
                (member.kind === ReflectionKind.literal &&
                    (typeof (member as TypeLiteral).literal === 'number' ||
                        typeof (member as TypeLiteral).literal === 'bigint' ||
                        typeof (member as TypeLiteral).literal === 'boolean'));
            if (isNumericOrBooleanType) continue;

            b.if_(b.not(b.getVar(matched)), () => {
                const checkExpr = getPrimitiveTypeCheck(member, input, b, true);
                // Check for undefined explicitly since Exec mode may return false (raw boolean)
                if (checkExpr !== undefined) {
                    b.if_(checkExpr, () => {
                        const memberResult = state.build(member, input);
                        b.setVar(result, memberResult);
                        b.setVar(matched, b.lit(true));
                    });
                }
            });
        }
    });

    // Third pass: try built-in class types (RegExp, Date, etc.) using instanceof checks
    // These don't use property scoring since they have special serialization handling
    // Also handle ReflectionKind.regexp which has its own kind (not ReflectionKind.class)
    const regexpMembers = sortedMembers.filter(m => m.kind === ReflectionKind.regexp);
    for (const member of regexpMembers) {
        b.if_(b.not(b.getVar(matched)), () => {
            // Check for RegExp instance OR serialized format { $regex: string, $options?: string }
            const isRegExpInstance = b.isInstance(input, RegExp);
            const isSerializedRegExp = b.and(
                b.isType(input, 'object'),
                b.and(b.not(b.isNull(input)), b.has(input, '$regex')),
            );
            const isRegExpLike = b.or(isRegExpInstance, isSerializedRegExp);
            b.if_(isRegExpLike, () => {
                const memberResult = state.build(member, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
    }

    const globalClassMembers = sortedMembers.filter(isGlobalTypeClass);

    for (const member of globalClassMembers) {
        const classType = (member as TypeClass).classType;

        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.isInstance(input, classType), () => {
                const memberResult = state.build(member, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
    }

    // Handle enum members - check if input is a valid enum value
    // Use getEnumValueIndexMatcher for case-insensitive matching of enum names
    const enumMembers = sortedMembers.filter(m => m.kind === ReflectionKind.enum);
    for (const member of enumMembers) {
        const enumType = member as TypeEnum;
        const matcher = getEnumValueIndexMatcher(enumType);
        b.if_(b.not(b.getVar(matched)), () => {
            // matcher returns -1 if no match, otherwise the index in enumType.values
            b.if_(b.neq(b.call(matcher, input), b.lit(-1)), () => {
                const memberResult = state.build(member, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
    }

    // Fourth pass: try class/object types
    // For better union member selection, we score object members by property match
    // Exclude arrays and tuples which are handled separately
    const objectMembers = sortedMembers.filter(
        m => m.kind === ReflectionKind.objectLiteral || m.kind === ReflectionKind.class,
    );
    const arrayMembers = sortedMembers.filter(m => m.kind === ReflectionKind.array || m.kind === ReflectionKind.tuple);

    // Handle object-like members with property-based scoring
    if (objectMembers.length > 0) {
        b.if_(b.not(b.getVar(matched)), () => {
            const isObj = b.and(
                b.isType(input, 'object'),
                b.and(b.not(b.isNull(input)), b.not(b.call(Array.isArray, input))),
            );

            b.if_(isObj, () => {
                // Score function: count matching properties for each member
                // Also checks nested literal values for better discriminator support
                const scoreMember = (inputObj: any, memberType: TypeObjectLiteral | TypeClass): number => {
                    // Safety check: only process types that have .types array
                    if (memberType.kind !== ReflectionKind.objectLiteral && memberType.kind !== ReflectionKind.class) {
                        return 0;
                    }
                    const members = resolveTypeMembers(memberType);
                    if (!members || !Array.isArray(members)) return 0;
                    let score = 0;
                    const inputKeys = new Set(Object.keys(inputObj));

                    for (const m of members) {
                        if (!isPropertyMemberType(m)) continue;
                        const propName = memberNameToString(m.name);
                        if (inputKeys.has(propName)) {
                            score += 100; // Property present in input

                            // Check if the member property has a literal type - give bonus for value match
                            if (m.type.kind === ReflectionKind.literal) {
                                const expectedLiteral = (m.type as TypeLiteral).literal;
                                if (inputObj[propName] === expectedLiteral) {
                                    score += 1000; // Strong bonus for literal match
                                } else {
                                    score -= 500; // Penalty for literal mismatch
                                }
                            }

                            // Check nested object literals for discriminator values
                            if (
                                (m.type.kind === ReflectionKind.objectLiteral ||
                                    m.type.kind === ReflectionKind.class) &&
                                typeof inputObj[propName] === 'object' &&
                                inputObj[propName] !== null
                            ) {
                                const nestedMembers = resolveTypeMembers(m.type as TypeObjectLiteral | TypeClass);
                                for (const nm of nestedMembers) {
                                    if (!isPropertyMemberType(nm)) continue;
                                    const nestedPropName = memberNameToString(nm.name);
                                    if (nm.type.kind === ReflectionKind.literal) {
                                        const expectedLiteral = (nm.type as TypeLiteral).literal;
                                        if (inputObj[propName][nestedPropName] === expectedLiteral) {
                                            score += 1000; // Strong bonus for nested literal match
                                        } else if (nestedPropName in inputObj[propName]) {
                                            score -= 500; // Penalty for nested literal mismatch
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Penalize members that don't have properties the input has
                    const memberKeys = new Set<string>();
                    for (const m of members) {
                        if (isPropertyMemberType(m)) memberKeys.add(memberNameToString(m.name));
                    }
                    for (const key of inputKeys) {
                        if (!memberKeys.has(key)) {
                            score -= 10; // Extra property in input not in member
                        }
                    }

                    return score;
                };

                // Find best matching member at runtime
                const findBestMember = (
                    inputObj: any,
                    memberTypes: Type[],
                    scoreFn: typeof scoreMember,
                ): Type | undefined => {
                    let bestMember: Type | undefined;
                    let bestScore = -Infinity;
                    for (const memberType of memberTypes) {
                        const memberScore = scoreFn(inputObj, memberType as TypeObjectLiteral | TypeClass);
                        if (memberScore > bestScore) {
                            bestScore = memberScore;
                            bestMember = memberType;
                        }
                    }
                    return bestMember;
                };

                // Get the best matching member at runtime and build it
                const buildBestMember = (
                    inputObj: any,
                    memberTypes: Type[],
                    scoreFn: typeof scoreMember,
                    st: JsonBuildContext,
                ): any => {
                    const bestMember = findBestMember(inputObj, memberTypes, scoreFn);
                    if (!bestMember) return undefined;
                    const serializer = (st as any).serializer;
                    const direction = (st as any).direction;
                    const fn =
                        direction === 'serialize'
                            ? serializer.buildSerializer(bestMember)
                            : serializer.buildDeserializer(bestMember);
                    return fn(inputObj, {});
                };

                const builtResult = b.call(
                    buildBestMember,
                    input,
                    b.lit(objectMembers),
                    b.lit(scoreMember),
                    b.lit(state),
                );
                b.if_(b.neq(builtResult, b.lit(undefined)), () => {
                    b.setVar(result, builtResult);
                    b.setVar(matched, b.lit(true));
                });
            });
        });
    }

    // Handle special class types (Map, Set) that serialize to arrays
    // These need special handling because their serialized form is an array
    const specialClassMembers = objectMembers.filter(
        m =>
            m.kind === ReflectionKind.class &&
            (m as TypeClass).classType &&
            ((m as TypeClass).classType === Map || (m as TypeClass).classType === Set),
    );

    if (specialClassMembers.length > 0) {
        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.call(Array.isArray, input), () => {
                // For arrays, try special class types first (Map/Set serialize to arrays)
                const trySpecialTypes = (inputArr: any, members: Type[], st: JsonBuildContext): any => {
                    for (const member of members) {
                        if (member.kind !== ReflectionKind.class) continue;
                        const classType = (member as TypeClass).classType;
                        if (classType === Map || classType === Set) {
                            // Try to deserialize as Map or Set
                            try {
                                const serializer = (st as any).serializer;
                                const fn = serializer.buildDeserializer(member);
                                return fn(inputArr, {});
                            } catch {
                                // If deserialization fails, continue to next
                            }
                        }
                    }
                    return undefined;
                };

                const specialResult = b.call(trySpecialTypes, input, b.lit(specialClassMembers), b.lit(state));
                b.if_(b.neq(specialResult, b.lit(undefined)), () => {
                    b.setVar(result, specialResult);
                    b.setVar(matched, b.lit(true));
                });
            });
        });
    }

    // Handle array members
    for (const member of arrayMembers) {
        b.if_(b.not(b.getVar(matched)), () => {
            b.if_(b.call(Array.isArray, input), () => {
                const memberResult = state.build(member, input);
                b.setVar(result, memberResult);
                b.setVar(matched, b.lit(true));
            });
        });
    }

    // If no match, throw error
    b.if_(b.not(b.getVar(matched)), () => {
        state.throw_(type, input, 'No union member matches');
    });

    return b.getVar(result);
}

/**
 * Main union handler that selects the appropriate strategy.
 */
export const handleUnion: TypeHandler<TypeUnion, JsonBuildContext> = (type, input, b, state) => {
    // === PHASE 1: Discriminator Detection (O(1)) ===
    const disc = detectDiscriminator(type);
    if (disc) {
        return buildDiscriminatedUnion(type, disc, input, b, state);
    }

    // === PHASE 2: Literal Set Optimization (O(1)) ===
    if (isAllLiterals(type) && type.types.length >= UNION_LITERAL_THRESHOLD) {
        return buildLiteralSetUnion(type, input, b, state);
    }

    // === PHASE 3: Scored Resolution ===
    return buildScoredUnion(type, input, b, state);
};

/**
 * Register union handler on a serializer.
 */
export function registerUnionHandler(serializer: { serializeRegistry: any; deserializeRegistry: any }): void {
    serializer.serializeRegistry.register(ReflectionKind.union, handleUnion);
    serializer.deserializeRegistry.register(ReflectionKind.union, handleUnion);
}
