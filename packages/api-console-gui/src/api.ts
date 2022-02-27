import { ControllerSymbol } from '@deepkit/rpc';
import { deserializeType, entity, Type } from '@deepkit/type';

export class ApiRouteParameter {
    name!: string;
    type!: 'body' | 'query' | 'url';
    schema: any;
}

@entity.name('.deepkit/api-console/route/response')
export class ApiRouteResponse {
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
    protected deserializedResultType?: Type;
    protected deserializedParameterType?: Type;

    //last entry is the actual schema, all other dependencies
    public parameterType: any; //SerializedTypes

    //last entry is the actual schema, all other dependencies
    public resultType: any; //SerializedTypes

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

    getParametersType(): Type | undefined {
        if (!this.deserializedParameterType) {
            this.deserializedParameterType = deserializeType(this.parameterType);
        }
        return this.deserializedParameterType;
    }

    getResultsType(): Type | undefined {
        if (!this.deserializedResultType) {
            this.deserializedResultType = deserializeType(this.resultType);
        }
        return this.deserializedResultType;
    }

    get id(): string {
        return this.controllerPath + '.' + this.methodName;
    }
}

@entity.name('.deepkit/api-console/route')
export class ApiRoute {
    public deserializedBodyType?: Type
    public deserializedQueryType?: Type;
    public deserializedUrlType?: Type;
    protected deserializedResultType?: Type;

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
            this.deserializedBodyType = deserializeType(bodySchemas);
        }
    }

    getBodyType(): Type | undefined {
        return this.deserializedBodyType;
    }

    getResultType(): Type | undefined {
        if (!this.deserializedResultType && this.resultType) {
            this.deserializedResultType = deserializeType(this.resultType);
        }
        return this.deserializedResultType;
    }

    getQueryType(): Type | undefined {
        if (!this.deserializedQueryType && this.queryType) {
            this.deserializedQueryType = deserializeType(this.queryType);
        }
        return this.deserializedQueryType;
    }

    getUrlType(): Type | undefined {
        if (!this.deserializedUrlType && this.urlType) {
            this.deserializedUrlType = deserializeType(this.urlType);
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
