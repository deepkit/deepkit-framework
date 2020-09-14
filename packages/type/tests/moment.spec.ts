import 'jest-extended';
import 'reflect-metadata';
import moment from 'moment';
import {getClassSchema, plainSerializer, t} from '../index';

test('test moment', () => {
    class Model {
        @t.moment
        created: moment.Moment = moment();
    }

    const schema = getClassSchema(Model);
    const prop = schema.getProperty('created');
    expect(prop.type).toBe('moment');


    const m = new Model;
    m.created = moment(new Date('2018-10-13T12:17:35.000Z'));

    const p = plainSerializer.for(Model).serialize(m);
    expect(p.created).toBeString();
    expect(p.created).toBe('2018-10-13T12:17:35.000Z');

    {
        const m = plainSerializer.for(Model).deserialize({
            created: '2018-10-13T12:17:35.000Z'
        });
        expect(m.created).toBeInstanceOf(moment);
        expect(m.created.toJSON()).toBe('2018-10-13T12:17:35.000Z' );
    }
});
