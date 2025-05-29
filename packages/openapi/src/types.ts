import { ClassType } from '@deepkit/core';
import type { parseRouteControllerAction } from '@deepkit/http';

export type SchemaMapper = (s: Schema, ...args: any[]) => Schema;

export type SimpleType = string | number | boolean | null | bigint;

export type Schema = {
    __type: 'schema';
    __registryKey?: string;
    __isComponent?: boolean;
    __isUndefined?: boolean;
    type?: string;
    not?: Schema;
    pattern?: string;
    multipleOf?: number;
    minLength?: number;
    maxLength?: number;
    minimum?: number | bigint;
    exclusiveMinimum?: number | bigint;
    maximum?: number | bigint;
    exclusiveMaximum?: number | bigint;
    enum?: SimpleType[];
    properties?: Record<string, Schema>;
    required?: string[];
    nullable?: boolean;
    items?: Schema;
    default?: any;
    oneOf?: Schema[];

    $ref?: string;
};

export const AnySchema: Schema = { __type: 'schema' };

export const NumberSchema: Schema = { __type: 'schema', type: 'number' };

export const StringSchema: Schema = { __type: 'schema', type: 'string' };

export const BooleanSchema: Schema = { __type: 'schema', type: 'boolean' };

export type RequestMediaTypeName = 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'application/json';

export type Tag = {
    __controller: ClassType;
    name: string;
};

export type OpenAPIResponse = {
    description: string;
    content: {
        'application/json'?: MediaType;
    };
};

export type Responses = Record<string, OpenAPIResponse>;

export type Operation = {
    __path: string;
    __method: string;
    tags: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    deprecated?: boolean;
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses?: Responses;
};

export type RequestBody = {
    content: Record<RequestMediaTypeName, MediaType>;
    required?: boolean;
};

export type MediaType = {
    schema?: Schema;
    example?: any;
};

export type Path = {
    summary?: string;
    description?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    trace?: Operation;
};

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export type ParameterIn = 'query' | 'header' | 'path' | 'cookie';

export type Parameter = {
    in: ParameterIn;
    name: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: Schema;
};

export type ParsedRoute = ReturnType<typeof parseRouteControllerAction>;

export type ParsedRouteParameter = ParsedRoute['parameters'][number];

export type Info = {
    title: string;
    description?: string;
    termsOfService?: string;
    contact: {};
    license: {};
    version: string;
};

export type Components = {
    schemas?: Record<string, Schema>;
};

export type OpenAPI = {
    openapi: string;
    info: Info;
    servers: {}[];
    paths: Record<string, Path>;
    components: Components;
};
