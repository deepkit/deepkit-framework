import { ClassSchema, deserializeSchemas, entity, SerializedSchema, serializedSchemaDefinition, t } from '@deepkit/type';
import { ControllerSymbol } from '@deepkit/rpc';

export class ApiRouteParameter {
    @t name!: string;
    @t.string type!: 'body' | 'query' | 'url';
    @t.any schema: any;
}

@entity.name('.deepkit/api-console/route')
export class ApiRoute {
    public deserializedBodySchemas: ClassSchema[] = [];

    @t.array(serializedSchemaDefinition) public resultSchemas: SerializedSchema[] = [];
    protected parsedResultSchemas: ClassSchema[] = [];

    constructor(
        @t.name('path') public path: string,
        @t.array(t.string).name('httpMethods') public httpMethods: string[],
        @t.name('controller') public controller: string,
        @t.name('description') public description: string,
        @t.array(ApiRouteParameter).name('parameters') public parameters: ApiRouteParameter[],
        @t.array(t.string).name('groups') public groups: string[],
        @t.string.name('category') public category: string,
        @t.array(serializedSchemaDefinition).name('bodySchemas') public bodySchemas: SerializedSchema[] = []
    ) {
        if (bodySchemas) {
            this.deserializedBodySchemas = deserializeSchemas(bodySchemas, '@api-console/');
        }
        // if (bodySchema) {
        //     if (bodySchema.classType) {
        //         //we don't and can't instantiate the full PropertySchema, since the
        //         //type is not available at runtime.
        //         bodySchema.classTypeName = bodySchema.classType;
        //         bodySchema.classType = undefined;
        //     }
        //     this.bodyPropertySchema = PropertySchema.fromJSON(bodySchema);
        // }
    }

    getResultSchemas(): ClassSchema[] {
        if (!this.parsedResultSchemas.length && this.resultSchemas.length > 0) {
            this.parsedResultSchemas = deserializeSchemas(this.resultSchemas, '@api-console/');
        }
        return this.parsedResultSchemas;
    }

    get id(): string {
        return this.httpMethods.join('-') + ':' + this.controller + ':' + this.path;
    }
}

export const ApiConsoleApi = ControllerSymbol<ApiConsoleApi>('.deepkit/api-console');

export interface ApiConsoleApi {
    getRoutes(): ApiRoute[];
}
