import { TypeLiteral } from '@deepkit/type';

import { TypeNotSupported } from './errors';
import { Schema, SchemaMapper } from './types';

export const validators: Record<string, SchemaMapper> = {
    pattern(s, type: TypeLiteral & { literal: RegExp }): Schema {
        return {
            ...s,
            pattern: type.literal.source,
        };
    },
    alpha(s): Schema {
        return {
            ...s,
            pattern: '^[A-Za-z]+$',
        };
    },
    alphanumeric(s): Schema {
        return {
            ...s,
            pattern: '^[0-9A-Za-z]+$',
        };
    },
    ascii(s): Schema {
        return {
            ...s,
            pattern: '^[\x00-\x7F]+$',
        };
    },
    dataURI(s): Schema {
        return {
            ...s,
            pattern: '^(data:)([w/+-]*)(;charset=[w-]+|;base64){0,1},(.*)',
        };
    },
    decimal(s, minDigits: TypeLiteral & { literal: number }, maxDigits: TypeLiteral & { literal: number }): Schema {
        return {
            ...s,
            pattern: '^-?\\d+\\.\\d{' + minDigits.literal + ',' + maxDigits.literal + '}$',
        };
    },
    multipleOf(s, num: TypeLiteral & { literal: number }): Schema {
        if (num.literal === 0) throw new TypeNotSupported(num, `multiple cannot be 0`);

        return {
            ...s,
            multipleOf: num.literal,
        };
    },
    minLength(s, length: TypeLiteral & { literal: number }): Schema {
        if (length.literal < 0) throw new TypeNotSupported(length, `length cannot be less than 0`);

        return {
            ...s,
            minLength: length.literal,
        };
    },
    maxLength(s, length: TypeLiteral & { literal: number }): Schema {
        if (length.literal < 0) throw new TypeNotSupported(length, `length cannot be less than 0`);

        return {
            ...s,
            maxLength: length.literal,
        };
    },
    includes(s, include: TypeLiteral): Schema {
        throw new TypeNotSupported(include, `includes is not supported. `);
    },
    excludes(s, exclude: TypeLiteral): Schema {
        throw new TypeNotSupported(exclude, `excludes is not supported. `);
    },
    minimum(s, min: TypeLiteral & { literal: number | bigint }): Schema {
        return {
            ...s,
            minimum: min.literal,
        };
    },
    exclusiveMinimum(s, min: TypeLiteral & { literal: number | bigint }): Schema {
        return {
            ...s,
            exclusiveMinimum: min.literal,
        };
    },
    maximum(s, max: TypeLiteral & { literal: number | bigint }): Schema {
        return {
            ...s,
            maximum: max.literal,
        };
    },
    exclusiveMaximum(s, max: TypeLiteral & { literal: number | bigint }): Schema {
        return {
            ...s,
            exclusiveMaximum: max.literal,
        };
    },
    positive(s): Schema {
        return {
            ...s,
            exclusiveMinimum: 0,
        };
    },
    negative(s): Schema {
        return {
            ...s,
            exclusiveMaximum: 0,
        };
    },
};
