import 'reflect-metadata';
import { ApiAction, ApiConsoleApi, ApiDocument, ApiEntryPoints, ApiRoute, ApiRouteResponse } from '@deepkit/api-console-gui/src/api';
import { getActionParameters, getActions, rpc, RpcKernel } from '@deepkit/rpc';
import { HttpRouteFilter, HttpRouterFilterResolver, parseRouteControllerAction } from '@deepkit/http';
import { createClassSchema, getClassSchema, SerializedSchema, serializeSchemas, t } from '@deepkit/type';
import { ClassType, getClassName } from '@deepkit/core';
import { config } from './module.config';
import { readFile } from 'fs/promises';
import { injectable } from '@deepkit/injector';

class Config extends config.slice('markdown', 'markdownFile') {
}

class ControllerNameGenerator {
    controllers = new Map<ClassType, string>();
    controllerNames = new Set<string>();

    getName(controller: ClassType): string {
        let controllerName = this.controllers.get(controller);
        if (!controllerName) {
            controllerName = getClassName(controller);
            let candidate = controllerName;
            let i = 2;
            while (this.controllerNames.has(candidate)) {
                candidate = controllerName + '#' + i++;
            }

            controllerName = candidate;
            this.controllers.set(controller, controllerName);
            this.controllerNames.add(controllerName);
        }
        return controllerName;
    }
}

@injectable
export class ApiConsoleController implements ApiConsoleApi {
    constructor(
        protected config: Config,
        protected filterResolver: HttpRouterFilterResolver,
        protected filter: HttpRouteFilter,
        @t.optional protected rpcKernel?: RpcKernel,
    ) {
    }

    @rpc.action()
    @t.generic(ApiDocument)
    async getDocument(): Promise<ApiDocument> {
        const document = new ApiDocument();

        document.markdown = this.config.markdown;

        if (this.config.markdownFile) {
            document.markdown = await readFile(this.config.markdownFile, 'utf8');
        }

        return document;
    }

    @rpc.action()
    @t.type(ApiEntryPoints)
    getEntryPoints(): ApiEntryPoints {
        const entryPoints = new ApiEntryPoints;
        entryPoints.httpRoutes = this.getHttpRoutes();
        entryPoints.rpcActions = this.getRpcActions();
        return entryPoints;
    }

    protected getRpcActions() {
        if (!this.rpcKernel) return [];

        const rpcActions: ApiAction[] = [];
        const nameGenerator = new ControllerNameGenerator;

        for (const [path, controller] of this.rpcKernel.controllers.entries()) {
            const actions = getActions(controller.controller);
            for (const [methodName, action] of actions.entries()) {

                const rpcAction = new ApiAction(
                    nameGenerator.getName(controller.controller),
                    path,
                    methodName,
                    action.description,
                    action.groups,
                    action.category
                );

                let resultProperty = getClassSchema(controller.controller).getMethod(methodName).clone();

                if (resultProperty.classType) {
                    // if (isPrototypeOfBase(resultProperty.classType, Promise)) {
                    //     resultProperty.type = 'any';
                    //     resultProperty.typeSet = false; //to signal type wasn't set
                    // } else if ((isPrototypeOfBase(resultProperty.classType, Observable)
                    //         || isPrototypeOfBase(resultProperty.classType, Collection)
                    //         || isPrototypeOfBase(resultProperty.classType, Promise))
                    //     || isPrototypeOfBase(resultProperty.classType, EntitySubject)
                    // ) {
                    //     resultProperty.classTypeName = 'Promise';
                    //     if (!resultProperty.templateArgs[0]) {
                    //         resultProperty.templateArgs[0] = new PropertySchema('T');
                    //         resultProperty.templateArgs[0].type = 'any';
                    //     }
                    // }
                }

                const of = `${getClassName(controller.controller)}.${methodName}`;

                try {
                    const resultSchema = createClassSchema();
                    resultSchema.registerProperty(resultProperty);
                    rpcAction.resultSchemas = serializeSchemas([resultSchema]);
                } catch (error) {
                    console.log(`Could not serialize result type of ${of}: ${error.message}`);
                }

                try {
                    const parameters = getActionParameters(controller.controller, methodName);
                    if (parameters.length) {
                        const argSchema = createClassSchema();
                        for (let i = 0; i < parameters.length; i++) {
                            argSchema.registerProperty(parameters[i]);
                        }
                        rpcAction.parameterSchemas = serializeSchemas([argSchema]);
                    }
                } catch (error) {
                    console.log(`Could not serialize parameter types of ${of}: ${error.message}`);
                }

                rpcActions.push(rpcAction);
            }
        }

        return rpcActions;
    }

    protected getHttpRoutes() {
        const routes: ApiRoute[] = [];

        const nameGenerator = new ControllerNameGenerator;

        for (const route of this.filterResolver.resolve(this.filter.model)) {
            if (route.internal) continue;

            const controllerName = nameGenerator.getName(route.action.controller);

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
