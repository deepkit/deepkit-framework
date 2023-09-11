import { ClassType } from '@deepkit/core';

export enum FrameCategory {
    none,
    http, httpController, rpc, rpcAuthenticate, cli, job, function, lock,
    workflow, event, database, databaseQuery, email, template,
}

export enum FrameType {
    start, end
}

export const categorySchemas: { [name in FrameCategory]: ClassType } = {
    [FrameCategory.none]: class {
    },
    [FrameCategory.http]: class {
        url?: string;
        method?: string;
        clientIp?: string;
        responseStatus?: number;
    },
    [FrameCategory.httpController]: class {
    },
    [FrameCategory.rpc]: class {
        method!: string;
        controller!: string;
        arguments!: any[];
    },
    [FrameCategory.cli]: class {
    },
    [FrameCategory.job]: class {
    },
    [FrameCategory.rpcAuthenticate]: class {
    },
    [FrameCategory.function]: class {
    },
    [FrameCategory.lock]: class {
    },
    [FrameCategory.workflow]: class {
    },
    [FrameCategory.event]: class {
    },
    [FrameCategory.database]: class {
        collection?: string;
        className?: string;
    },
    [FrameCategory.databaseQuery]: class {
        sql!: string;
        sqlParams?: any[];
    },
    [FrameCategory.email]: class {
    },
    [FrameCategory.template]: class {
    },
};

export type FrameCategoryModel = { [T in keyof typeof categorySchemas]: (typeof categorySchemas)[T] };

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
    data: any;
}
