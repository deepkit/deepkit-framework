import { expect, jest, test } from '@jest/globals';
import { http } from '../src/decorator';
import { HttpRequest } from '../src/model';
import {
    RouteConfig,
    RouteParameterResolver,
    RouteParameterResolverContext,
} from '../src/router';
import { createHttpKernel } from './utils';

test('parameter resolver by name', async () => {
    class Resolver implements RouteParameterResolver {
        resolve(context: RouteParameterResolverContext) {
            return 'value';
        }
    }

    @http.controller()
    class Controller {
        @http.GET().resolveParameterByName('value', Resolver)
        route(value: unknown) {}
    }

    jest.spyOn(Resolver.prototype, 'resolve');
    jest.spyOn(Controller.prototype, 'route');

    const httpKernel = createHttpKernel([Controller], [Resolver]);
    await httpKernel.request(HttpRequest.GET('/'));

    const expectedContext: RouteParameterResolverContext = {
        name: 'value',
        token: undefined,
        value: undefined,
        route: expect.any(RouteConfig) as any,
        request: expect.anything() as any,
        query: {},
        parameters: { value: 'value' },
    };
    expect(Resolver.prototype.resolve).toHaveBeenCalledWith(expectedContext);
    expect(Controller.prototype.route).toHaveBeenCalledWith('value');
});
