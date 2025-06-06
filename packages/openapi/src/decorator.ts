import { HttpController, HttpControllerDecorator, httpAction, httpClass } from '@deepkit/http';
import {
    DualDecorator,
    PropertyDecoratorFn,
    ReceiveType,
    UnionToIntersection,
    createClassDecoratorContext,
    mergeDecorator,
} from '@deepkit/type';

class HttpOpenApiController extends HttpController {
    name: string;
}

class HttpOpenApiControllerDecorator extends HttpControllerDecorator {
    override t = new HttpOpenApiController();

    // TODO: add name directly on HttpControllerDecorator
    name(name: string) {
        this.t.name = name;
    }
}

export const httpOpenApiController = createClassDecoratorContext(HttpOpenApiControllerDecorator);

//this workaround is necessary since generic functions are lost during a mapped type and changed ReturnType
type HttpMerge<U> = {
    [K in keyof U]: K extends 'response'
        ? <T2>(statusCode: number, description?: string, type?: ReceiveType<T2>) => PropertyDecoratorFn & U
        : U[K] extends (...a: infer A) => infer R
          ? R extends DualDecorator
              ? (...a: A) => PropertyDecoratorFn & R & U
              : (...a: A) => R
          : never;
};
type MergedHttp<T extends any[]> = HttpMerge<Omit<UnionToIntersection<T[number]>, '_fetch' | 't'>>;

export const http = mergeDecorator(httpClass, httpOpenApiController, httpAction) as any as MergedHttp<
    [typeof httpOpenApiController, typeof httpAction]
>;
