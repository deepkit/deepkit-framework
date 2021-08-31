import { ClassSchema, deserializeSchemas, entity, SerializedSchema, serializedSchemaDefinition, t } from '@deepkit/type';
import { ControllerSymbol } from '@deepkit/rpc';

export class ApiRouteParameter {
    @t name!: string;
    @t.string type!: 'body' | 'query' | 'url';
    @t.any schema: any;
}

@entity.name('.deepkit/api-console/route/response')
export class ApiRouteResponse {
    public deserializedSchemas?: ClassSchema[];

    constructor(
        @t.name('statusCode') public statusCode: number,
        @t.name('description') public description: string,
        @t.array(serializedSchemaDefinition).name('serializedSchemas') public serializedSchemas: SerializedSchema[], //the last entry has only `v` property with the response type
    ) {
    }

    getSchemas(): ClassSchema[] {
        if (!this.deserializedSchemas) {
            this.deserializedSchemas = deserializeSchemas(this.serializedSchemas);
        }
        return this.deserializedSchemas;
    }
}

@entity.name('.deepkit/api-console/document')
export class ApiDocument {
    @t markdown?: string;
}

@entity.name('.deepkit/api-console/action')
export class ApiAction {
    protected deserializedResultSchemas?: ClassSchema[];
    protected deserializedParameterSchemas?: ClassSchema[];

    //last entry is the actual schema, all other dependencies
    @t.array(serializedSchemaDefinition) public parameterSchemas: SerializedSchema[] = [];

    //last entry is the actual schema, all other dependencies
    @t.array(serializedSchemaDefinition) public resultSchemas: SerializedSchema[] = [];

    public parameterSignature: string = '';
    public returnSignature: string = '';

    constructor(
        @t.name('controllerClassName') public controllerClassName: string,
        @t.name('controllerPath') public controllerPath: string,
        @t.name('methodName') public methodName: string,
        @t.name('description') public description: string,
        @t.array(t.string).name('groups') public groups: string[],
        @t.string.name('category') public category: string,
    ) {
    }

    getParametersSchemas(): ClassSchema[] {
        if (!this.deserializedParameterSchemas) {
            this.deserializedParameterSchemas = deserializeSchemas(this.parameterSchemas);
        }
        return this.deserializedParameterSchemas;
    }

    getResultsSchemas(): ClassSchema[] {
        if (!this.deserializedResultSchemas) {
            this.deserializedResultSchemas = deserializeSchemas(this.resultSchemas);
        }
        return this.deserializedResultSchemas;
    }

    get id(): string {
        return this.controllerPath + '.' + this.methodName;
    }
}

@entity.name('.deepkit/api-console/route')
export class ApiRoute {
    public deserializedBodySchemas: ClassSchema[] = [];
    public deserializedQuerySchema?: ClassSchema;
    public deserializedUrlSchema?: ClassSchema;
    protected parsedResultSchemas: ClassSchema[] = [];

    //last entry is the actual schema, all other dependencies
    @t.array(serializedSchemaDefinition) public querySchemas: SerializedSchema[] = [];

    //last entry is the actual schema, all other dependencies
    @t.array(serializedSchemaDefinition) public resultSchemas: SerializedSchema[] = [];

    //last entry is the actual schema, all other dependencies
    @t.array(serializedSchemaDefinition) public urlSchemas: SerializedSchema[] = [];

    @t.array(ApiRouteResponse) responses: ApiRouteResponse[] = [];

    constructor(
        @t.name('path') public path: string,
        @t.array(t.string).name('httpMethods') public httpMethods: string[],
        @t.name('controller') public controller: string,
        @t.name('action') public action: string,
        @t.name('description') public description: string,
        @t.array(t.string).name('groups') public groups: string[],
        @t.string.name('category') public category: string,
        @t.array(serializedSchemaDefinition).name('bodySchemas') public bodySchemas: SerializedSchema[] = []
    ) {
        if (bodySchemas) {
            this.deserializedBodySchemas = deserializeSchemas(bodySchemas);
        }
    }

    getBodySchema(): ClassSchema | undefined {
        if (!this.deserializedBodySchemas.length) return;

        return this.deserializedBodySchemas[this.deserializedBodySchemas.length - 1];
    }

    getResultSchema(): ClassSchema | undefined {
        if (!this.parsedResultSchemas.length && this.resultSchemas.length > 0) {
            this.parsedResultSchemas = deserializeSchemas(this.resultSchemas);
        }
        return this.parsedResultSchemas[this.parsedResultSchemas.length - 1];
    }

    getQuerySchema(): ClassSchema | undefined {
        if (!this.deserializedQuerySchema && this.querySchemas.length > 0) {
            const schemas = deserializeSchemas(this.querySchemas);
            this.deserializedQuerySchema = schemas[schemas.length - 1];
        }
        return this.deserializedQuerySchema;
    }

    getUrlSchema(): ClassSchema | undefined {
        if (!this.deserializedUrlSchema && this.urlSchemas.length > 0) {
            const schemas = deserializeSchemas(this.urlSchemas);
            this.deserializedUrlSchema = schemas[schemas.length - 1];
        }
        return this.deserializedUrlSchema;
    }

    get id(): string {
        return this.controller + '.' + this.action;
    }
}


export class ApiEntryPoints {
    @t.array(ApiRoute) httpRoutes: ApiRoute[] = [];
    @t.array(ApiAction) rpcActions: ApiAction[] = [];
}

export const ApiConsoleApi = ControllerSymbol<ApiConsoleApi>('.deepkit/api-console', [ApiRoute, ApiDocument]);

export interface ApiConsoleApi {
    getEntryPoints(): ApiEntryPoints;

    getDocument(): Promise<ApiDocument>;
}
