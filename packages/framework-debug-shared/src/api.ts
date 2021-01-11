import { entity, PropertySchema, PropertySchemaSerialized, t } from '@deepkit/type';
import { Collection, ControllerSymbol } from '@deepkit/rpc';
import { DebugRequest } from './model';

export class ConfigOption {
    @t name!: string;
    @t type!: string;
    @t.any defaultValue!: any;
    @t.any value!: any;
    @t.optional description?: string;
}

@entity.name('debug/workflow')
export class Workflow {
    @t.array(t.string) places!: string[];
    @t.array(t.schema({ from: t.string, to: t.string, label: t.string.optional })) transitions!: { from: string, to: string, label?: string; }[];
}

@entity.name('debug/database/entity')
export class DatabaseEntity {
    @t.optional name?: string;
    @t className!: string;
}

@entity.name('debug/database')
export class Database {
    @t name!: string;
    @t adapter!: string;

    @t.array(DatabaseEntity) entities: DatabaseEntity[] = [];
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
        @t public path: string,
        @t public httpMethod: string,
        @t public controller: string,
        @t public description: string,
        @t.array(RouteParameter) public parameters: RouteParameter[],
        @t.array(t.string) public groups: string[],
        @t.string public category: string,
        @t.any public bodySchema?: PropertySchemaSerialized,
    ) {
        if (bodySchema) {
            if (bodySchema.classType) {
                //we don't and can't instantiate the full PropertySchema, since the
                //type is not available at runtime.
                bodySchema.classTypeName = bodySchema.classType;
                bodySchema.classType = undefined;
            }
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

@entity.name('rpc/event')
export class Event {
    @t event!: string;
    @t controller!: string;
    @t methodName!: string;
    @t priority!: number;
}

export const DebugControllerInterface = ControllerSymbol<DebugControllerInterface>('debug/controller');
export interface DebugControllerInterface {
    configuration(): Config;

    databases(): Database[];

    routes(): Route[];

    actions(): RpcAction[];

    getWorkflow(name: string): Workflow;

    events(): Event[];

    httpRequests(): Promise<Collection<DebugRequest>>;
}
