import { BodyValidation, HtmlResponse, http, HttpResponse, Redirect, UploadedFile } from '@deepkit/http';
import { Logger } from '@deepkit/logger';
import { readFile } from 'fs/promises';
import { SQLiteDatabase, User } from '../database';
import { sliceClass, t } from '@deepkit/type';
import { UserList } from '../views/user-list';

class AddUserDto extends sliceClass(User).include('username') {
    @t imageUpload?: UploadedFile;
}

@http.controller()
export class MainController {
    constructor(protected logger: Logger, protected database: SQLiteDatabase) {
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
        return await this.database.query(User).filter({id}).findOne();
    }

    @http.DELETE('/api/user/:id')
    async deleteUser(id: number) {
        const res = await this.database.query(User).filter({id}).deleteOne();
        return res.modified === 1;
    }

    @http.GET('/benchmark')
    benchmark() {
        return 'hi';
    }

    @http.GET('/image/:id')
    async userImage(id: number, response: HttpResponse) {
        const user = await this.database.query(User).filter({id}).findOne();
        if (!user.image) {
            return new HtmlResponse('Not found', 404);
        }
        return response.end(user.image);
    }

    @http.POST('/add').description('Adds a new user')
    async add(@http.body() body: AddUserDto, bodyValidation: BodyValidation) {
        if (bodyValidation.hasErrors()) return <UserList error={bodyValidation.getErrorMessageForPath('username')}/>;

        const user = new User(body.username);
        if (body.imageUpload) {
            //alternatively, move the file to `var/` and store its path into `user.image` (change it to a string)
            user.image = await readFile(body.imageUpload.path);
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
    async queryParam(@http.query() peter: string) {
        return peter;
    }
}
