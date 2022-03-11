import { ApiAction, ApiConsoleApi, ApiDocument, ApiEntryPoints, ApiRoute, ApiRouteResponse } from '@deepkit/api-console-gui/src/api';
import { getActions, rpc, RpcKernel } from '@deepkit/rpc';
import { HttpRouteFilter, HttpRouterFilterResolver, parseRouteControllerAction } from '@deepkit/http';
import { ClassType, getClassName } from '@deepkit/core';
import { Config } from './module.config';
import { readFile } from 'fs/promises';
import { ReflectionClass, ReflectionKind, serializeType, Type, TypeClass, TypeObjectLiteral, TypePropertySignature } from '@deepkit/type';

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

export class ApiConsoleController implements ApiConsoleApi {
    constructor(
        protected config: Config,
        protected filterResolver: HttpRouterFilterResolver,
        protected filter: HttpRouteFilter,
        protected rpcKernel?: RpcKernel,
    ) {
    }

    @rpc.action()
    async getDocument(): Promise<ApiDocument> {
        const document = new ApiDocument();

        document.markdown = this.config.markdown;

        if (this.config.markdownFile) {
            document.markdown = await readFile(this.config.markdownFile, 'utf8');
        }

        return document;
    }

    @rpc.action()
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

                const reflectionMethod = ReflectionClass.from(controller.controller).getMethod(methodName);

                const of = `${getClassName(controller.controller)}.${methodName}`;

                try {
                    //todo: Collection, SubjectEntity, Observable get pretty big
                    rpcAction.methodType = serializeType(reflectionMethod.method);
                } catch (error: any) {
                    console.log(`Could not serialize result type of ${of}: ${error.message}`);
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
                routeD.responses.push(new ApiRouteResponse(
                    response.statusCode, response.description, response.type ? serializeType(response.type) : undefined
                ));
            }

            const parsedRoute = parseRouteControllerAction(route);
            const urlType: TypeObjectLiteral = {
                kind: ReflectionKind.objectLiteral,
                types: [],
            };
            let queryType: TypeObjectLiteral | TypeClass = {
                kind: ReflectionKind.objectLiteral,
                types: [],
            };

            for (const parameter of parsedRoute.getParameters()) {
                if (parameter.body || parameter.bodyValidation) {
                    routeD.bodySchemas = serializeType(parameter.parameter.type);
                } else if (parameter.query || parameter.queries) {
                    if (parameter.queries) {
                        //if there is a typePath set, all sub properties get their own property
                        if (parameter.typePath) {
                            // property.name = parameter.typePath;
                            // querySchema.registerProperty(property);
                            (queryType as TypeObjectLiteral).types.push({
                                kind: ReflectionKind.propertySignature, name: parameter.typePath, type: parameter.parameter.type as Type
                            } as TypePropertySignature)
                        } else {
                            if (parameter.parameter.type.kind !== ReflectionKind.class && parameter.parameter.type.kind !== ReflectionKind.objectLiteral) {
                                continue;
                            }
                            //anything else is on the root level
                            queryType = parameter.parameter.type;
                        }
                    } else {
                        (queryType as TypeObjectLiteral).types.push({
                            kind: ReflectionKind.propertySignature,
                            name: parameter.typePath || parameter.getName(),
                            type: parameter.parameter.type as Type
                        } as TypePropertySignature)
                    }
                } else if (parameter.isPartOfPath()) {
                    urlType.types.push({
                        kind: ReflectionKind.propertySignature,
                        name: parameter.typePath || parameter.getName(),
                        type: parameter.parameter.type as Type
                    } as TypePropertySignature)
                } else {
                    //its a dependency injection token
                }
            }

            const reflectionMethod = ReflectionClass.from(route.action.controller).getMethod(route.action.methodName);

            routeD.resultType = serializeType(reflectionMethod.getReturnType());
            if (urlType.types.length) routeD.urlType = serializeType(urlType);
            if (queryType.types.length) routeD.queryType = serializeType(queryType);
            routes.push(routeD);
        }

        return routes;
    }
}
