import {ClassType} from '@super-hornet/core';
import {Session} from './session';

export class SecurityStrategy {
    /**
     * Method to check whether given session (created by authenticate) has access to controller::action.
     */
    public async hasAccess<T>(session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to register peer controller of name `controllerName`.
     */
    public async isAllowedToRegisterPeerController<T>(session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to send messages to peer controller of name `controllerName`.
     */
    public async isAllowedToSendToPeerController<T>(session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Authenticates the current connection.
     */
    public async authenticate(token: any): Promise<Session> {
        return new Session('anon', undefined);
    }
}
