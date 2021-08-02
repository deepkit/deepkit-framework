import { ClassSchema, t } from '@deepkit/type';

export enum FrameCategory {
    none,
    http, httpController, rpc, rpcAuthenticate, cli, job, function, lock,
    workflow, event, database, databaseQuery, email, template,
}

export enum FrameType {
    start, end
}

export const categorySchemas: { [name in FrameCategory]: ClassSchema } = {
    [FrameCategory.none]: t.schema({
    }),
    [FrameCategory.http]: t.schema({
        url: t.string.optional,
        method: t.string.optional,
        clientIp: t.string.optional,
        responseStatus: t.number.optional,
    }),
    [FrameCategory.httpController]: t.schema({
    }),
    [FrameCategory.rpc]: t.schema({
        method: t.string,
        controller: t.string,
        arguments: t.array(t.any)
    }),
    [FrameCategory.cli]: t.schema({
    }),
    [FrameCategory.job]: t.schema({
    }),
    [FrameCategory.rpcAuthenticate]: t.schema({
    }),
    [FrameCategory.function]: t.schema({
    }),
    [FrameCategory.lock]: t.schema({
    }),
    [FrameCategory.workflow]: t.schema({
    }),
    [FrameCategory.event]: t.schema({
    }),
    [FrameCategory.database]: t.schema({
        collection: t.string.optional,
        className: t.string.optional,
    }),
    [FrameCategory.databaseQuery]: t.schema({
        sql: t.string.optional,
        sqlParams: t.array(t.any).optional
    }),
    [FrameCategory.email]: t.schema({
    }),
    [FrameCategory.template]: t.schema({
    }),
};

export type FrameCategoryModel = {[T in keyof typeof categorySchemas]: (typeof categorySchemas)[T]['classType'] };

export interface FrameStart {
    id: number;
    worker: number;
    type: FrameType.start;
    timestamp: number;
    context: number;
    label: string;
    category: FrameCategory;
}

export interface FrameEnd {
    id: number;
    worker: number;
    type: FrameType.end;
    timestamp: number;
}

export interface FrameData {
    id: number;
    worker: number;
    category: FrameCategory;
    data: any
}
