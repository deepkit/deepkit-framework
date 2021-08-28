import 'reflect-metadata';
import { ApiConsoleApi, ApiDocument, ApiRoute, ApiRouteResponse } from '@deepkit/api-console-gui/src/api';
import { rpc } from '@deepkit/rpc';
import { HttpRouteFilter, HttpRouterFilterResolver, parseRouteControllerAction } from '@deepkit/http';
import { createClassSchema, getClassSchema, SerializedSchema, serializeSchemas, t } from '@deepkit/type';
import { ClassType, getClassName } from '@deepkit/core';
import { config } from './module.config';
import { readFile } from 'fs/promises';
import { injectable } from '@deepkit/injector';

class Config extends config.slice('markdown', 'markdownFile') {
}

@injectable
export class ApiConsoleController implements ApiConsoleApi {
    constructor(
        protected config: Config,
        protected filterResolver: HttpRouterFilterResolver,
        protected filter: HttpRouteFilter,
    ) {
    }

    @rpc.action()
    @t.type(ApiDocument)
    async getDocument(): Promise<ApiDocument> {
        const document = new ApiDocument();

        document.markdown = this.config.markdown;

        if (this.config.markdownFile) {
            document.markdown = await readFile(this.config.markdownFile, 'utf8');
        }

        return document;
    }

    @rpc.action()
    @t.array(ApiRoute)
    getRoutes(): ApiRoute[] {
        const routes: ApiRoute[] = [];

        const controllers = new Map<ClassType, string>();
        const controllerNames = new Set<string>();

        for (const route of this.filterResolver.resolve(this.filter.model)) {
            if (route.internal) continue;

            let controllerName = controllers.get(route.action.controller);
            if (!controllerName) {
                controllerName = getClassName(route.action.controller);
                let candidate = controllerName;
                let i = 2;
                while (controllerNames.has(candidate)) {
                    candidate = controllerName + '#' + i;
                }

                controllerName = candidate;
                controllers.set(route.action.controller, controllerName);
                controllerNames.add(controllerName);
            }
            const routeD = new ApiRoute(
                route.getFullPath(), route.httpMethods,
                controllerName,
                route.action.methodName,
                route.description,
                route.groups,
                route.category,
            );

            for (const response of route.responses) {
                let schemas: SerializedSchema[] = [];
                if (response.type && response.type.type !== 'any') {
                    const schema = createClassSchema();
                    response.type.name = 'v';
                    schema.registerProperty(response.type);
                    schemas = serializeSchemas([schema]);
                }
                routeD.responses.push(new ApiRouteResponse(
                    response.statusCode, response.description, schemas
                ));
            }

            const parsedRoute = parseRouteControllerAction(route);
            const querySchema = createClassSchema();
            const urlSchema = createClassSchema();

            for (const parameter of parsedRoute.getParameters()) {
                if (parameter === parsedRoute.customValidationErrorHandling) continue;
                if (parameter.body) {
                    const bodySchema = parameter.property.getResolvedClassSchema();
                    routeD.bodySchemas = serializeSchemas([bodySchema]);
                } else if (parameter.query || parameter.queries) {
                    const property = parameter.property.clone();

                    if (parameter.queries) {
                        //if there is a typePath set, all sub properties get their own property
                        if (parameter.typePath) {
                            property.name = parameter.typePath;
                            querySchema.registerProperty(property);
                        } else {
                            //anything else is on the root level
                            for (const subProperty of property.getResolvedClassSchema().getProperties()) {
                                querySchema.registerProperty(subProperty);
                            }
                        }
                    } else {
                        if (parameter.typePath) property.name = parameter.typePath;
                        querySchema.registerProperty(property);
                    }
                } else if (parameter.isPartOfPath()) {
                    const p = parameter.property.clone();
                    if (parameter.typePath) p.name = parameter.typePath;
                    p.data['.deepkit/api-console/regex'] = route.parameterRegularExpressions[p.name];
                    urlSchema.registerProperty(p);
                } else {
                    //its a dependency injection token
                }
            }

            const schema = getClassSchema(route.action.controller);
            const prop = schema.getMethod(route.action.methodName).clone();
            if (prop.type !== 'any') {
                const resultSchema = createClassSchema();
                prop.name = 'v';
                resultSchema.registerProperty(prop);
                routeD.resultSchemas = serializeSchemas([resultSchema]);
            }

            if (urlSchema.getProperties().length) {
                routeD.urlSchemas = serializeSchemas([urlSchema]);
            }

            if (querySchema.getProperties().length) {
                routeD.querySchemas = serializeSchemas([querySchema]);
            }

            routes.push(routeD);
        }

        return routes;
    }
}
