import { entity, plainToClass, t } from '@deepkit/type';
import { expect } from '@jest/globals';
import { DatabaseFactory } from './test';

@entity.collectionName('persons')
abstract class Person {
    @t.primary.autoIncrement id: number = 0;
    @t firstName?: string;
    @t lastName?: string;
    @t.discriminant abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    @t email?: string;

    @t.literal('employee') type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    @t.literal('freelancer') type: 'freelancer' = 'freelancer';
}

@entity.collectionName('projects')
class Project {
    @t.primary.autoIncrement id: number = 0;

    constructor(
        @t.reference() public owner: Person,
        @t public title: string
    ) {
    }
}

const entities = [Employee, Freelancer, Project];

export const companyTests = {
    async tableLevelInheritance(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const freelance1 = plainToClass(Freelancer, { firstName: 'Peter' });
        expect(freelance1.type).toBe('freelancer');
        await database.persist(freelance1);

        await database.persist(plainToClass(Freelancer, { firstName: 'Marie' }));
        await database.persist(plainToClass(Employee, { firstName: 'Marc' }));
        await database.persist(plainToClass(Employee, { firstName: 'Lui' }));

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
        expect(persons[0]).toBeInstanceOf(Freelancer);
        expect(persons[0].id).toBe(1);
        expect(persons[1]).toBeInstanceOf(Freelancer);
        expect(persons[1].id).toBe(2);
        expect(persons[2]).toBeInstanceOf(Employee);
        expect(persons[2].id).toBe(3);
        expect(persons[3]).toBeInstanceOf(Employee);
        expect(persons[3].id).toBe(4);
    },

    async tableLevelInheritanceJoins(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const peter = plainToClass(Freelancer, { firstName: 'Peter' });
        await database.persist(peter, plainToClass(Freelancer, { firstName: 'Marie' }), plainToClass(Employee, { firstName: 'Marc' }), plainToClass(Employee, { firstName: 'Lui' }));

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
    },
};
