import { http } from '../../src/decorator.js';
import { HttpBody } from '../../src/model.js';

// Interface defined in the same file as the controller
export interface UserBody {
    username: string;
    email: string;
}

// Class defined in the same file as the controller
export class CreatePostBody {
    title!: string;
    content!: string;
}

export class SeparateFileController {
    @http.PUT('/test-body-any')
    async handleBodyAny(body: HttpBody<any>): Promise<any> {
        return { received: body };
    }

    @http.POST('/test-body-interface')
    async handleBodyInterface(body: HttpBody<UserBody>): Promise<any> {
        return { username: body.username, email: body.email };
    }

    @http.POST('/test-body-class')
    async handleBodyClass(body: HttpBody<CreatePostBody>): Promise<any> {
        return { title: body.title, content: body.content, isClass: body instanceof CreatePostBody };
    }

    @http.POST('/test-body-inline')
    async handleBodyInline(body: HttpBody<{ name: string; age: number }>): Promise<any> {
        return { name: body.name, age: body.age };
    }
}
