import { rpc } from '@deepkit/rpc';
import { AppSession } from '@app/server/rpc';
import { Database } from '@deepkit/orm';
import { BlogEntity, getTitleFromBlocks, setTitleAndSlugFromBlocks } from '@app/common/models';

@rpc.controller('admin')
export class AdminController {
    constructor(
        private session: AppSession,
        private database: Database,
    ) {
    }

    @rpc.action()
    async getUser(): Promise<{ email: string }> {
        return { email: this.session.user.email };
    }

    @rpc.action()
    async getPosts(): Promise<BlogEntity[]> {
        return await this.database.query(BlogEntity)
            .orderBy('publishedAt', 'desc')
            .orderBy('id', 'asc')
            .find();
    }

    @rpc.action()
    async getPost(id: number): Promise<BlogEntity> {
        return await this.database.query(BlogEntity)
            .filter({ id })
            .findOne();
    }

    @rpc.action()
    async createPost(content: BlogEntity['content']): Promise<BlogEntity> {
        const post = new BlogEntity();
        post.content = content;
        setTitleAndSlugFromBlocks(post);
        await this.database.persist(post);
        return post;
    }

    @rpc.action()
    async savePost(post: BlogEntity): Promise<BlogEntity['id']> {
        if (!post.id) throw new Error('No post id provided');
        setTitleAndSlugFromBlocks(post);
        const entity = await this.database.query(BlogEntity)
            .filter({ id: post.id })
            .findOne();
        Object.assign(entity, post);
        try {
            await this.database.persist(entity);
            return entity.id;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
