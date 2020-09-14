import {MongoAuth} from './auth';
import {BaseResponse, Command} from '../command';
import {MongoClientConfig} from '../../client';
import {t} from '@deepkit/marshal';


class AuthenticateCommand extends t.class({
    authenticate: t.literal(1),
    mechanism: t.string,
    $db: t.string,
    username: t.string.optional,
}) {
}

class AuthenticateResponse extends t.class({
}, {extend: BaseResponse}) {
}


export class X509Auth implements MongoAuth {
    async auth(command: Command, config: MongoClientConfig): Promise<void> {
        await command.sendAndWait(AuthenticateCommand, {
            authenticate: 1,
            mechanism: 'MONGODB-X509',
            $db: '$external',
            username: config.authUser
        }, AuthenticateResponse);
    }
}