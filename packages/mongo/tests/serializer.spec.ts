import 'jest';
import {t} from '@deepkit/type';
import {mongoSerializer} from '../src/mongo-serializer';


test('date', () => {
    const s = t.schema({
        created: t.date,
    });

    const s2 = t.schema({
        moderator: s,
        created: t.date,
    });

    const res = mongoSerializer.for(s2).serialize({moderator: {created: new Date()}, created: new Date()});
    expect(res.created).toBeInstanceOf(Date);
    expect(res.moderator.created).toBeInstanceOf(Date);
});
