import {entity, t} from '@deepkit/type';
import {ControllerSymbol} from '@deepkit/framework-shared';

@entity.name('debug/config')
export class Config {
    @t.map(t.any) applicationConfig!: {};
    @t.map(t.any) configuration!: {};
}

export const DebugControllerSymbol = ControllerSymbol<DebugControllerInterface>('debug/controller')

export interface DebugControllerInterface {
    configuration(): Config;
}
