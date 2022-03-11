import { HtmlResponse, http, HttpBodyValidation, HttpQuery, HttpResponse, Redirect, UploadedFile } from '@deepkit/http';
import { LoggerInterface } from '@deepkit/logger';
import { readFile } from 'fs/promises';
import { SQLiteDatabase, User } from '../database';
import { UserList } from '../views/user-list';

class AddUserDto extends User {
    imageUpload?: UploadedFile;
}

@http.controller()
export class MainController {
    constructor(protected logger: LoggerInterface, protected database: SQLiteDatabase) {
    }

    @http.GET('/').name('startPage').description('List all users')
    async startPage() {
        return <UserList/>;
    }

    @http.GET('/api/users')
    async users(): Promise<User[]> {
        return await this.database.query(User).find();
    }

    @http.GET('/api/user/:id')
    async user(id: number): Promise<User> {
        return await this.database.query(User).filter({ id }).findOne();
    }

    @http.DELETE('/api/user/:id')
    async deleteUser(id: number) {
        const res = await this.database.query(User).filter({ id }).deleteOne();
        return res.modified === 1;
    }

    @http.GET('/benchmark')
    benchmark() {
        return 'hi';
    }

    @http.GET('/image/:id')
    async userImage(id: number, response: HttpResponse) {
        const user = await this.database.query(User).filter({ id }).findOne();
        if (!user.image) {
            return new HtmlResponse('Not found', 404);
        }
        return response.end(user.image);
    }

    @http.POST('/add').description('Adds a new user')
    async add(body: HttpBodyValidation<AddUserDto>) {
        if (!body.valid()) return <UserList error={body.error.getErrorMessageForPath('username')}/>;

        const user = new User(body.value.username);
        if (body.value.imageUpload) {
            //alternatively, move the file to `var/` and store its path into `user.image` (change it to a string)
            user.image = await readFile(body.value.imageUpload.path);
        }
        this.logger.log('New user!', user);
        await this.database.persist(user);

        return Redirect.toRoute('startPage');
    }

    @http.GET('/path/:name')
    async urlParam(name: string) {
        return name;
    }

    @http.GET('/query')
    async queryParam(peter: HttpQuery<string>) {
        return peter;
    }
}
