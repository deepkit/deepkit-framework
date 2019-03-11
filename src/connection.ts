import {Injectable, Injector} from "injection-js";
import {Observable} from "rxjs";
import {Application, SessionStack} from "./application";
import {ClientMessageAll} from "@marcj/glut-core";
import {ConnectionMiddleware} from "./connection-middleware";
import {ConnectionWriter} from "./connection-writer";


@Injectable()
export class Connection {
    protected timeoutTimers: NodeJS.Timeout[] = [];
    protected destroyed = false;

    constructor(
        protected app: Application,
        protected sessionStack: SessionStack,
        protected injector: Injector,
        protected connectionMiddleware: ConnectionMiddleware,
        protected writer: ConnectionWriter,
    ) {
    }

    public destroy() {
        this.connectionMiddleware.destroy();
        this.destroyed = true;

        for (const timeout of this.timeoutTimers) {
            clearTimeout(timeout);
        }
    }

    public isActive(): boolean {
        return !this.destroyed;
    }

    /**
     * Creates a regular timer using setTimeout() and automatically cancel it once the connection breaks or server stops.
     */
    public setTimeout(cb: () => void, timeout: number): NodeJS.Timeout {
        const timer = setTimeout(cb, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    public async onMessage(raw: string) {
        if ('string' === typeof raw) {
            const message = JSON.parse(raw) as ClientMessageAll;

            if (message.name === 'action') {
                // console.log('Got action', message);
                try {
                    this.send(message, () => this.action(message.controller, message.action, message.args));
                } catch (error) {
                    console.log('Unhandled action error', error);
                }
            }

            if (message.name === 'authenticate') {
                this.sessionStack.setSession(await this.app.authenticate(this.injector, message.token));

                this.writer.write({
                    type: 'authenticate/result',
                    id: message.id,
                    result: this.sessionStack.isSet(),
                });
            }

            await this.connectionMiddleware.messageIn(message);
        }
    }

    public async action(controller: string, action: string, args: any[]): Promise<any> {
        const controllerClass = await this.app.resolveController(controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${controller}`);
        }

        const access = await this.app.hasAccess(this.injector, this.sessionStack.getSession(), controllerClass, action);
        if (!access) {
            throw new Error(`Access denied`);
        }

        const controllerInstance = this.injector.get(controllerClass);

        const methodName = action;

        if ((controllerInstance as any)[methodName]) {
            const actions = Reflect.getMetadata('kamille:actions', controllerClass.prototype) || {};

            if (!actions[methodName]) {
                console.log('Action unknown, but method exists.', methodName);
                throw new Error(`Action unknown ${methodName}`);
            }

            try {
                //todo, convert args via plainToClass

                const result = (controllerInstance as any)[methodName](...args);
                return result;
            } catch (error) {
                // possible security whole, when we send all errors.
                console.error(error);
                throw new Error(`Action ${methodName} failed: ${error}`);
            }
        }

        console.error('Action unknown', methodName);
        throw new Error(`Action unknown ${methodName}`);
    }

    public async send(message: ClientMessageAll, exec: (() => Promise<any> | Observable<any>)) {
        try {
            let result = exec();

            if (typeof (result as any)['then'] === 'function') {
                // console.log('its an Promise');
                result = await result;
            }

            await this.connectionMiddleware.messageOut(message, result);
        } catch (error) {
            console.log('Worker execution error', message, error);
            await this.writer.sendError(message.id, error);
        }
    }
}
