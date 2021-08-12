import { ApiConsoleApi, ApiRoute } from '@deepkit/api-console-gui/src/api';
import { rpc } from '@deepkit/rpc';
import { parseRouteControllerAction, Router } from '@deepkit/http';
import { serializeSchemas, t } from '@deepkit/type';
import { getClassName } from '@deepkit/core';

@rpc.controller(ApiConsoleApi)
export class ApiConsoleController implements ApiConsoleApi {

    constructor(protected router: Router) {
    }

    @rpc.action()
    @t.array(ApiRoute)
    getRoutes(): ApiRoute[] {
        const routes: ApiRoute[] = [];

        for (const route of this.router.getRoutes()) {
            const routeD = new ApiRoute(
                route.getFullPath(), route.httpMethods,
                getClassName(route.action.controller) + '.' + route.action.methodName,
                route.description,
                [],
                route.groups,
                route.category,
            );

            const parsedRoute = parseRouteControllerAction(route);

            const queryParameters: string[] = [];
            for (const parameter of parsedRoute.getParameters()) {
                if (parameter === parsedRoute.customValidationErrorHandling) continue;
                if (parameter.body) {
                    const bodySchema = parameter.property.getResolvedClassSchema();
                    routeD.bodySchemas = serializeSchemas([bodySchema]);
                } else if (parameter.query) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'query',
                        schema: parameter.property.toJSON(),
                    });
                    queryParameters.push(`${parameter.getName()}=${parameter.property.toString()}`);
                } else if (parameter.isPartOfPath()) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'url',
                        schema: parameter.property.toJSON(),
                    });
                } else {
                    //its a dependency injection token
                }
            }

            // if (queryParameters.length) {
            //     routeD.path += '?' + queryParameters.join('&');
            // }

            routes.push(routeD);
        }

        return routes;
    }
}
