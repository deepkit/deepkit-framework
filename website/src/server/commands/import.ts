import { Database } from '@deepkit/orm';
import { findParentPath } from '@deepkit/app';
import { readdir } from 'fs/promises';
import { PageProcessor } from '@app/server/page-processor';
import { CommunityMessage } from '@app/common/models';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function importExamples(
    database: Database,
    page: PageProcessor
) {
    const dir = findParentPath('src/pages/examples', __dirname);
    if (!dir) throw new Error('Examples folder not found');
    const files = await readdir(dir);

    await database.query(CommunityMessage)
        .filter({ type: 'example', source: 'markdown' })
        .deleteMany();

    for (const file of files) {
        const session = database.createSession();
        const category = file.replace('.md', '');
        const examples = await page.parseExamples(category, true);
        for (const e of examples) {
            const message = new CommunityMessage('', '', e.content || '');
            message.title = e.title;
            message.slug = e.title.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
            message.category = category;
            message.source = 'markdown';
            message.type = 'example';
            message.meta.url = e.url;
            session.add(message);
        }
        await session.commit();
    }
}

export async function importQuestions(
    database: Database,
    page: PageProcessor
) {
    const dir = findParentPath('src/pages/questions', __dirname);
    if (!dir) throw new Error('Examples folder not found');
    const files = await readdir(dir);

    await database.query(CommunityMessage)
        .filter({ type: 'answer',  source: 'markdown' })
        .deleteMany();

    for (const file of files) {
        if (file.startsWith('_')) continue;
        const session = database.createSession();
        const category = file.replace('.md', '');
        const questions = await page.parseQuestions(category, 1000);
        for (const q of questions) {
            if (!q.content) continue;
            const message = new CommunityMessage('', '', q.content || '');
            message.title = q.title;
            message.source = 'markdown';
            message.order = 1;
            message.type = 'answer';
            message.votes = 50; //high initial votes for default questions to make them appear on top
            message.slug = q.title.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
            message.category = category;
            message.assistant = true;
            session.add(message);
        }
        await session.commit();
    }
}
