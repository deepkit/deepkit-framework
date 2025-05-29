import { TypeAnnotation } from '@deepkit/core';

export type Format<Name extends string> = TypeAnnotation<'openapi:format', Name>;
export type Default<Value extends string | number | (() => any)> = TypeAnnotation<'openapi:default', Value>;
export type Description<Text extends string> = TypeAnnotation<'openapi:description', Text>;
export type Deprecated = TypeAnnotation<'openapi:deprecated', true>;
export type Name<Text extends string> = TypeAnnotation<'openapi:name', Text>;
