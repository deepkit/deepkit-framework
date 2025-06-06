import { ClassType, getClassName } from '@deepkit/core';
import { Type, stringifyType } from '@deepkit/type';

export class OpenApiError extends Error {}

export class OpenApiTypeError extends OpenApiError {}

export class OpenApiTypeNotSupportedError extends OpenApiTypeError {
    constructor(
        public type: Type,
        public reason = '',
    ) {
        super(`${stringifyType(type)} is not supported. ${reason}`);
    }
}

export class OpenApiLiteralNotSupportedError extends OpenApiTypeError {
    constructor(public typeName: string) {
        super(`${typeName} is not supported. `);
    }
}

export class OpenApiTypeErrors extends OpenApiError {
    constructor(
        public errors: OpenApiTypeError[],
        message: string,
    ) {
        super(message);
    }
}

export class OpenApiSchemaNameConflictError extends OpenApiError {
    constructor(
        public newType: Type,
        public oldType: Type,
        name: string,
    ) {
        super(
            `"${stringifyType(newType)}" and "${stringifyType(
                oldType,
            )}" are different, but their schema is both named as ${JSON.stringify(name)}. Try to fix the naming of related types, or rename them using 'YourClass & Name<ClassName>'`,
        );
    }
}

export class OpenApiControllerNameConflictError extends OpenApiError {
    constructor(
        public newController: ClassType,
        public oldController: ClassType,
        name: string,
    ) {
        super(
            `${getClassName(newController)} and ${getClassName(oldController)} are both tagged as ${name}. Please consider renaming them.`,
        );
    }
}

export class OpenApiOperationNameConflictError extends OpenApiError {
    constructor(
        public fullPath: string,
        public method: string,
    ) {
        super(`Operation ${method} ${fullPath} is repeated. Please consider renaming them. `);
    }
}
