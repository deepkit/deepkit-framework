import 'jest-extended';
import 'reflect-metadata';
import * as moment from 'moment';
import {t} from "@super-hornet/marshal";
import {classToMongo, mongoToClass} from "../index";

test('test moment', () => {
    class Model {
        @t.moment
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
        expect(moment.isMoment(m.created)).toBe(true);
        expect(m.created.toJSON()).toBe('2018-10-13T12:17:35.000Z' );
    }
});
