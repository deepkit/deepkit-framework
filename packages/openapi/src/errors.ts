import { ClassType, getClassName } from '@deepkit/core';
import { Type, stringifyType } from '@deepkit/type';

export class OpenApiError extends Error {}

export class TypeError extends OpenApiError {}

export class TypeNotSupported extends TypeError {
    constructor(
        public type: Type,
        public reason: string = '',
    ) {
        super(`${stringifyType(type)} is not supported. ${reason}`);
    }
}

export class LiteralSupported extends TypeError {
    constructor(public typeName: string) {
        super(`${typeName} is not supported. `);
    }
}

export class TypeErrors extends OpenApiError {
    constructor(
        public errors: TypeError[],
        message: string,
    ) {
        super(message);
    }
}

export class OpenApiSchemaNameConflict extends OpenApiError {
    constructor(
        public newType: Type,
        public oldType: Type,
        public name: string,
    ) {
        super(
            `${stringifyType(newType)} and ${stringifyType(
                oldType,
            )} are not the same, but their schema are both named as ${JSON.stringify(name)}. ` +
                `Try to fix the naming of related types, or rename them using 'YourClass & Name<ClassName>'`,
        );
    }
}

export class OpenApiControllerNameConflict extends OpenApiError {
    constructor(
        public newController: ClassType,
        public oldController: ClassType,
        public name: string,
    ) {
        super(
            `${getClassName(newController)} and ${getClassName(oldController)} are both tagged as ${name}. ` +
                `Please consider renaming them. `,
        );
    }
}

export class OpenApiOperationNameConflict extends OpenApiError {
    constructor(
        public fullPath: string,
        public method: string,
    ) {
        super(`Operation ${method} ${fullPath} is repeated. Please consider renaming them. `);
    }
}
