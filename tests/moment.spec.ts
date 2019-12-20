import 'jest-extended'
import 'reflect-metadata';
import * as moment from 'moment';
import {f} from "@marcj/marshal";
import {classToMongo, mongoToClass} from "..";

test('test moment', () => {
    class Model {
        @f.moment()
        created: moment.Moment = moment();
    }

    const m = new Model;
    m.created = moment(new Date('2018-10-13T12:17:35.000Z'));

    const p = classToMongo(Model, m);
    expect(p.created).toBeDate();
    expect(p.created.toJSON()).toBe('2018-10-13T12:17:35.000Z');

    {
        const m = mongoToClass(Model, {
            created: new Date('2018-10-13T12:17:35.000Z')
        });
        expect(m.created).toBeInstanceOf(moment);
        expect(m.created.toJSON()).toBe('2018-10-13T12:17:35.000Z' );
    }
});
