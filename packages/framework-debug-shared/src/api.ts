import {entity, PropertySchema, t} from '@deepkit/type';
import {ControllerSymbol} from '@deepkit/framework-shared';

export class ConfigOption {
    @t name!: string;
    @t type!: string;
    @t.any defaultValue!: any;
    @t.any value!: any;
    @t.optional description?: string;
}

@entity.name('debug/config')
export class Config {
    @t.array(ConfigOption) appConfig!: ConfigOption[];
    @t.array(ConfigOption) modulesConfig!: ConfigOption[];
}

export class RouteParameter {
    @t name!: string;
    @t.string type!: 'body' | 'query' | 'url';
    @t.any schema: any;
}

@entity.name('debug/route')
export class Route {
    public bodyPropertySchema?: PropertySchema;

    constructor(
        // @t public path: string,
        @t public path: string,
        @t public httpMethod: string,
        @t public controller: string,
        @t public description: string,
        @t.array(RouteParameter) public parameters: RouteParameter[],
        @t.any public bodySchema?: any,
    ) {
        if (bodySchema) {
            this.bodyPropertySchema = PropertySchema.fromJSON(bodySchema);
        }
    }
}

@entity.name('rpc/action/parameter')
export class RpcActionParameter {
    public propertySchema: PropertySchema;

    constructor(
        @t public name: string,
        @t.any public schema: any,
    ) {
        this.propertySchema = PropertySchema.fromJSON(schema);
    }
}


@entity.name('rpc/action')
export class RpcAction {
    @t path!: string;
    @t controller!: string;
    @t methodName!: string;
    @t.array(RpcActionParameter) parameters!: RpcActionParameter[];
}

export const DebugControllerSymbol = ControllerSymbol<DebugControllerInterface>('debug/controller');

export interface DebugControllerInterface {
    configuration(): Config;

    routes(): Route[];

    actions(): RpcAction[];
}
