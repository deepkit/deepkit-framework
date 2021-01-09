import { ClassType } from "@deepkit/core";
import { RpcKernelSecurity, Session } from "@deepkit/rpc";
import { InjectorContext } from "./injector/injector";

export class RpcInjectorContext extends InjectorContext {}

export class DeepkitRpcSession extends Session {}

export class DeepkitRpcSecurity extends RpcKernelSecurity<DeepkitRpcSession> {
    async hasControllerAccess(session: DeepkitRpcSession, classType: ClassType, method: string): Promise<boolean> {
        return true;
    }
    
    async isAllowedToRegisterAsPeer(session: DeepkitRpcSession, peerId: string): Promise<boolean> {
        return true;
    }
    
    async isAllowedToSendToPeer(session: DeepkitRpcSession, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any): Promise<DeepkitRpcSession> {
        throw new Error('Authentication not implemented');
    }
}