import { App, AppModule } from '@deepkit/app';
import { expect, jest, test } from '@jest/globals';
import { http } from '../src/decorator.js';
import { HttpRequest } from '../src/model.js';
import { RouteConfig, RouteParameterResolver, RouteParameterResolverContext, } from '../src/router.js';
import { createHttpKernel } from './utils.js';
import { HttpModule } from '../src/module.js';
import { HttpKernel } from '../src/kernel.js';
import { ReflectionClass } from '@deepkit/type';

test('parameter resolver by name', async () => {
    class Resolver implements RouteParameterResolver {
        resolve(context: RouteParameterResolverContext) {
            return 'value';
        }
    }

    @http.controller()
    class Controller {
        @http.GET().resolveParameterByName('value', Resolver)
        route(value: unknown) {
        }
    }

    jest.spyOn(Resolver.prototype, 'resolve');
    jest.spyOn(Controller.prototype, 'route');

    const httpKernel = createHttpKernel([Controller], [Resolver]);
    await httpKernel.request(HttpRequest.GET('/'));

    const reflectionClass = ReflectionClass.from(Controller).getMethod('route');
    const reflectionParameter = reflectionClass.getParameter('value');

    const expectedContext: RouteParameterResolverContext = {
        name: 'value',
        token: undefined,
        value: undefined,
        route: expect.any(RouteConfig) as any,
        request: expect.anything() as any,
        query: {},
        parameters: { value: 'value' },
        type: reflectionParameter
    };
    expect(Resolver.prototype.resolve).toHaveBeenCalledWith(expectedContext);
    expect(Controller.prototype.route).toHaveBeenCalledWith('value');
});

test('parameter resolver can be retrieved from parent module', async () => {
    class Resolver implements RouteParameterResolver {
        resolve(context: RouteParameterResolverContext) {
            return 'value';
        }
    }

    @http.controller()
    class Controller {
        @http.GET().resolveParameterByName('value', Resolver)
        route(value: unknown) {
            return value;
        }
    }

    const module = new AppModule({
        controllers: [Controller],
    });

    const app = new App({
        providers: [Resolver],
        imports: [module, new HttpModule()],
    });

    const kernel = app.get(HttpKernel);

    const response = await kernel.request(HttpRequest.GET('/'));
    expect(response.json).toBe('value');
});
