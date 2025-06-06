import { ReflectionKind } from '@deepkit/type';

import { OpenApiError, OpenApiTypeError } from './errors';
import { SchemaRegistry } from './schema-registry';
import { resolveTypeSchema } from './type-schema-resolver';
import { MediaType, Parameter, ParsedRoute, RequestBody, RequestMediaTypeName } from './types';

export class ParametersResolver {
    parameters: Parameter[] = [];
    requestBody?: RequestBody;
    errors: OpenApiTypeError[] = [];

    constructor(
        private parsedRoute: ParsedRoute,
        private schemeRegistry: SchemaRegistry,
        private contentTypes?: RequestMediaTypeName[],
    ) {}

    resolve() {
        for (const parameter of this.parsedRoute.getParameters()) {
            const type = parameter.getType();

            if (parameter.query) {
                const schemaResult = resolveTypeSchema(type, this.schemeRegistry);

                this.errors.push(...schemaResult.errors);

                this.parameters.push({
                    in: 'query',
                    name: parameter.getName(),
                    schema: schemaResult.result,
                    required: !parameter.parameter.isOptional(),
                });
            } else if (parameter.queries) {
                if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) {
                    throw new OpenApiError('HttpQueries should be either class or object literal. ');
                }

                const schemaResult = resolveTypeSchema(type, this.schemeRegistry);

                this.errors.push(...schemaResult.errors);

                for (const [name, property] of Object.entries(schemaResult.result.properties!)) {
                    if (!this.parameters.find(p => p.name === name)) {
                        this.parameters.push({
                            in: 'query',
                            name,
                            schema: property,
                            required: schemaResult.result.required?.includes(name),
                        });
                    } else {
                        this.errors.push(
                            new OpenApiTypeError(
                                `Parameter name ${JSON.stringify(name)} is repeated. Please consider renaming them. `,
                            ),
                        );
                    }
                }
            } else if (parameter.isPartOfPath()) {
                const schemaResult = resolveTypeSchema(type, this.schemeRegistry);

                this.errors.push(...schemaResult.errors);

                this.parameters.push({
                    in: 'path',
                    name: parameter.getName(),
                    schema: schemaResult.result,
                    required: true,
                });
            } else if (parameter.body || parameter.bodyValidation) {
                if (
                    type.kind !== ReflectionKind.array &&
                    type.kind !== ReflectionKind.class &&
                    type.kind !== ReflectionKind.objectLiteral
                ) {
                    throw new OpenApiError(
                        'HttpBody or HttpBodyValidation should be either array, class, or object literal.',
                    );
                }

                const bodySchema = resolveTypeSchema(type, this.schemeRegistry);

                this.errors.push(...bodySchema.errors);

                const contentTypes = this.contentTypes ?? [
                    'application/json',
                    'application/x-www-form-urlencoded',
                    'multipart/form-data',
                ];

                this.requestBody = {
                    content: Object.fromEntries(
                        contentTypes.map(contentType => [
                            contentType,
                            {
                                schema: bodySchema.result,
                            },
                        ]),
                    ) as Record<RequestMediaTypeName, MediaType>,
                    required: !parameter.parameter.isOptional(),
                };
            }
        }

        return this;
    }
}
