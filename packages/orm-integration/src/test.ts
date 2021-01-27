import { ClassSchema } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { ClassType } from '@deepkit/core';

export type DatabaseFactory = (entities?: (ClassSchema | ClassType)[]) => Promise<Database>;
