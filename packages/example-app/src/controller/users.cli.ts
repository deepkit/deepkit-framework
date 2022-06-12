import { arg, cli, Command, flag } from '@deepkit/app';
import { LoggerInterface } from '@deepkit/logger';
import { SQLiteDatabase, User } from '../database';
import { Positive } from '@deepkit/type';

@cli.controller('users')
export class UsersCommand implements Command {
    constructor(protected logger: LoggerInterface, protected database: SQLiteDatabase) {
    }

    async execute(@flag id: number[] = []): Promise<any> {
        this.logger.log('Loading users ...', id);
        // const users = await this.database.query(User).find();
        // console.table(users);
    }
}
