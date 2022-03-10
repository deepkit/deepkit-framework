import { ControllerSymbol } from '@deepkit/rpc';
import { deserializeType, entity, Excluded, ReflectionClass, ReflectionKind, Type, TypeMethod, TypeParameter } from '@deepkit/type';

export class ApiRouteParameter {
    name!: string;
    type!: 'body' | 'query' | 'url';
    schema: any;
}

@entity.name('.deepkit/api-console/route/response')
export class ApiRouteResponse {
    /** @reflection never */
    public type?: Type;

    constructor(
        public statusCode: number,
        public description: string,
        public serializedType: any,
    ) {
    }

    getType(): Type {
        if (!this.type) {
            this.type = deserializeType(this.serializedType);
        }
        return this.type;
    }
}

@entity.name('.deepkit/api-console/document')
export class ApiDocument {
    markdown?: string;
}

@entity.name('.deepkit/api-console/action')
export class ApiAction {
    /** @reflection never */
    protected deserializedMethodType?: TypeMethod & Excluded;

    //last entry is the actual schema, all other dependencies
    public methodType: any; //SerializedTypeMethod

    public parameterSignature: string = '';
    public returnSignature: string = '';

    constructor(
        public controllerClassName: string,
        public controllerPath: string,
        public methodName: string,
        public description: string,
        public groups: string[],
        public category: string,
    ) {
    }

    getMethodType(): TypeMethod {
        if (!this.deserializedMethodType) {
            this.deserializedMethodType = deserializeType(this.methodType) as TypeMethod;
        }
        return this.deserializedMethodType;
    }

    /** @reflection never */
    getParametersType(): TypeParameter[] {
        return this.getMethodType().parameters;
    }

    /** @reflection never */
    getResultsType(): Type | undefined {
        return this.getMethodType().return;
    }

    /** @reflection never */
    get id(): string {
        return this.controllerPath + '.' + this.methodName;
    }
}

@entity.name('.deepkit/api-console/route')
export class ApiRoute {
    public deserializedBodyType?: ReflectionClass<any> & Excluded;
    public deserializedQueryType?: ReflectionClass<any> & Excluded;
    public deserializedUrlType?: ReflectionClass<any> & Excluded;

    /** @reflection never */
    protected deserializedResultType?: Type & Excluded;

    //last entry is the actual schema, all other dependencies
    public queryType: any; //SerializedTypes

    //last entry is the actual schema, all other dependencies
    public resultType: any; //SerializedTypes

    //last entry is the actual schema, all other dependencies
    public urlType: any; //SerializedTypes

    responses: ApiRouteResponse[] = [];

    constructor(
        public path: string,
        public httpMethods: string[],
        public controller: string,
        public action: string,
        public description: string,
        public groups: string[],
        public category: string,
        public bodySchemas?: any, //SerializedTypes
    ) {
        if (bodySchemas) {
            const type = deserializeType(bodySchemas);
            if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
                this.deserializedBodyType = ReflectionClass.from(type);
            }
        }
    }

    /** @reflection never */
    getBodyType(): ReflectionClass<any> | undefined {
        return this.deserializedBodyType;
    }

    /** @reflection never */
    getResultType(): Type | undefined {
        if (!this.deserializedResultType && this.resultType) {
            this.deserializedResultType = deserializeType(this.resultType);
        }
        return this.deserializedResultType;
    }

    /** @reflection never */
    getQueryType(): ReflectionClass<any> | undefined {
        if (!this.deserializedQueryType && this.queryType) {
            const type = deserializeType(this.queryType);
            if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
                this.deserializedQueryType = ReflectionClass.from(type);
            }
        }
        return this.deserializedQueryType;
    }

    /** @reflection never */
    getUrlType(): ReflectionClass<any> | undefined {
        if (!this.deserializedUrlType && this.urlType) {
            const type = deserializeType(this.urlType);
            if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
                this.deserializedUrlType = ReflectionClass.from(type);
            }
        }
        return this.deserializedUrlType;
    }

    get id(): string {
        return this.controller + '.' + this.action;
    }
}

export class ApiEntryPoints {
    httpRoutes: ApiRoute[] = [];
    rpcActions: ApiAction[] = [];
}

export const ApiConsoleApi = ControllerSymbol<ApiConsoleApi>('.deepkit/api-console', [ApiRoute, ApiDocument]);

export interface ApiConsoleApi {
    getEntryPoints(): ApiEntryPoints;

    getDocument(): Promise<ApiDocument>;
}
