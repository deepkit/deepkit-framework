import { AutoIncrement, cast, entity, PrimaryKey, Reference, t } from '@deepkit/type';
import { expect } from '@jest/globals';
import { DatabaseFactory } from './test';

@entity.collection('persons')
abstract class Person {
    id: number & PrimaryKey & AutoIncrement = 0;
    firstName?: string;
    lastName?: string;
    abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    @t email?: string;

    type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    type: 'freelancer' = 'freelancer';
}

@entity.collection('projects')
class Project {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        public owner: Person & Reference,
        public title: string
    ) {
    }
}

const entities = [Employee, Freelancer, Project, Person];

export const companyTests = {
    async tableLevelInheritanceBasics(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const freelance1 = cast<Freelancer>({ firstName: 'Peter' });
        expect(freelance1.type).toBe('freelancer');
        await database.persist(freelance1);

        await database.persist(cast<Freelancer>({ firstName: 'Marie' }));
        await database.persist(cast<Employee>({ firstName: 'Marc' }));
        await database.persist(cast<Employee>({ firstName: 'Lui' }));

        const freelancers = await database.query(Freelancer).find();
        expect(freelancers.length).toBe(2);
        expect(freelancers[0]).toBeInstanceOf(Freelancer);
        expect(freelancers[1]).toBeInstanceOf(Freelancer);
        expect(freelancers[0].type).toBe('freelancer');
        expect(freelancers[1].type).toBe('freelancer');
        expect(freelancers[0].id).toBe(1);
        expect(freelancers[1].id).toBe(2);

        const employees = await database.query(Employee).find();
        expect(employees.length).toBe(2);
        expect(employees[0]).toBeInstanceOf(Employee);
        expect(employees[1]).toBeInstanceOf(Employee);
        expect(employees[0].type).toBe('employee');
        expect(employees[1].type).toBe('employee');
        expect(employees[0].id).toBe(3);
        expect(employees[1].id).toBe(4);

        const persons = await database.query(Person).find();
        expect(persons[0].id).toBe(1);
        expect(persons[0].type).toBe('freelancer');
        expect(persons[0]).toBeInstanceOf(Freelancer);
        expect(persons[1].id).toBe(2);
        expect(persons[1].type).toBe('freelancer');
        expect(persons[1]).toBeInstanceOf(Freelancer);
        expect(persons[2].id).toBe(3);
        expect(persons[2].type).toBe('employee');
        expect(persons[2]).toBeInstanceOf(Employee);
        expect(persons[3].id).toBe(4);
        expect(persons[3].type).toBe('employee');
        expect(persons[3]).toBeInstanceOf(Employee);
        database.disconnect();
    },

    async tableLevelInheritanceJoins(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const peter = cast<Freelancer>({ firstName: 'Peter' });
        expect(peter.firstName).toBe('Peter')

        const marie = cast<Freelancer>({ firstName: 'Marie' });
        expect(marie.firstName).toBe('Marie')

        const marc = cast<Employee>({ firstName: 'Marc' });
        expect(marc.firstName).toBe('Marc')

        await database.persist(peter, marie, marc, cast<Employee>({ firstName: 'Lui' }));

        {
            const project = new Project(peter, 'My project');
            await database.persist(project);
        }

        {
            const project = await database.query(Project).joinWith('owner').findOne();
            expect(project.owner).toBeInstanceOf(Freelancer);
            expect(project.owner.id).toBe(1);
            expect(project.owner.firstName).toBe('Peter');
        }
        database.disconnect();
    },
};
