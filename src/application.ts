import {Injectable, Injector} from "injection-js";
import {ClassType} from "@marcj/estdlib";
import {GlutFile} from "@marcj/glut-core";

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }

    public isAnonymouse(): boolean {
        return undefined === this.token;
    }
}

@Injectable()
export class SessionStack {
    protected session?: Session;

    public setSession(session: Session | undefined) {
        this.session = session;
    }

    public isSet(): boolean {
        return this.session !== undefined;
    }

    public getSessionOrUndefined(): Session | undefined {
        return this.session;
    }

    public getSession(): Session {
        if (!this.session) {
            throw new Error('No session given.');
        }

        return this.session;
    }
}

@Injectable()
export class Application {
    public readonly controllers: { [name: string]: ClassType<any> } = {};
    public readonly entityChangeFeeds: ClassType<any>[] = [GlutFile];

    /**
     * Method executed in the master process, right before workers are forked.
     */
    public async bootstrap() {
    }

    /**
     * Method to check whether given session (created by authenticate) has access to controller::action.
     */
    public async hasAccess<T>(injector: Injector, session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to register peer controller of name `controllerName`.
     */
    public async isAllowedToRegisterPeerController<T>(injector: Injector, session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to send messages to peer controller of name `controllerName`.
     */
    public async isAllowedToSendToPeerController<T>(injector: Injector, session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Resolves a name to a controller.
     */
    public async resolveController(name: string): Promise<ClassType<any> | undefined> {
        return this.controllers[name];
    }

    /**
     * Authenticates the current connection.
     */
    public async authenticate(injector: Injector, token: any): Promise<Session> {
        return new Session('anon', undefined);
    }

    /**
     * Whether changes to that entity should be broadcasted to all subscribers.
     */
    notifyChanges<T>(classType: ClassType<T>): boolean {
        return -1 !== this.entityChangeFeeds.indexOf(classType);
    }
}
