// import { ClassType } from '@deepkit/core';
// import { createTestingApp as createTestingAppOriginal, LiveDatabase, TestingFacade } from '@deepkit/framework';
// import { App, AppModule, RootModuleDefinition } from '@deepkit/app';
// import { Database, DatabaseRegistry } from '@deepkit/orm';
// import { Collection, IdInterface, rpc } from '@deepkit/rpc';
// import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
// import { AutoIncrement, BackReference, entity, PrimaryKey, Reference, uuid, UUID } from '@deepkit/type';
// import { expect, test } from '@jest/globals';
//
// export function createTestingApp<O extends RootModuleDefinition>(options: O, entities?: (ClassType)[]): TestingFacade<App<O>> {
//     return createTestingAppOriginal(options, [], (module: AppModule<any>) => {
//         module.addProvider({ provide: Database, useValue: new Database(new SQLiteDatabaseAdapter('/tmp/live-database.sqlite'), entities) })
//         module.setupGlobalProvider(DatabaseRegistry).addDatabase(Database, { migrateOnStartup: true }, module);
//     }) as any;
// }
//
// (global as any)['createTestingApp'] ||= createTestingApp;
//
// test('test entity collection reactive find', async () => {
//     @entity.name.name('entitySyncTeam')
//     class Team implements IdInterface {
//         id: UUID & PrimaryKey = uuid();
//
//         version: number = 0;
//
//         constructor(public name: string) {
//         }
//     }
//
//     @entity.name('entitySyncUser')
//     class User implements IdInterface {
//         id: UUID & PrimaryKey = uuid();
//
//         version: number = 0;
//
//         teams: Team[] & BackReference<{via: UserTeam}> = [];
//
//         constructor(public name: string) {
//         }
//     }
//
//     @entity.name('entitySyncUserTeam')
//     class UserTeam {
//         id: number & PrimaryKey & AutoIncrement = 0;
//
//         version: number = 0;
//
//         constructor(
//             public team: Team & Reference,
//             public user: User & Reference,
//         ) {
//         }
//     }
//
//     @rpc.controller('test')
//     class TestController {
//         constructor(
//             private liveDatabase: LiveDatabase,
//             private database: Database,
//         ) {
//             this.liveDatabase.enableChangeFeed(User, Team, UserTeam);
//         }
//
//         @rpc.action()
//         async init() {
//             await this.database.query(User).deleteMany();
//             await this.database.query(Team).deleteMany();
//             await this.database.query(UserTeam).deleteMany();
//
//             const teamA = new Team('Team a');
//             const teamB = new Team('Team b');
//
//             await this.database.persist(teamA);
//             await this.database.persist(teamB);
//
//             const addUser = async (name: string, team: Team) => {
//                 const user = new User(name);
//                 await this.database.persist(user);
//                 await this.database.persist(new UserTeam(team, user));
//             };
//
//             await addUser('Peter 1', teamA);
//             await addUser('Peter 2', teamA);
//             await addUser('Marc 1', teamA);
//
//             await addUser('Marie', teamB);
//         }
//
//         @rpc.action()
//         async unAssignUser(userName: string, teamName: string) {
//             const user = await this.database.query(User).filter({ name: userName }).findOne();
//             const team = await this.database.query(Team).filter({ name: teamName }).findOne();
//
//             if (!user) throw new Error(`User ${userName} not found`);
//             if (!team) throw new Error(`Team ${teamName} not found`);
//
//             console.log('unassigned', user.name, 'from', team.name);
//             await this.database.query(UserTeam).filter({ user: user, team: team }).deleteMany();
//         }
//
//         @rpc.action()
//         async getUserId(userName: string): Promise<string> {
//             const user = await this.database.query(User).filter({ name: userName }).findOne();
//             if (!user) throw new Error(`User ${userName} not found`);
//
//             return user.id;
//         }
//
//         @rpc.action()
//         async assignUser(userName: string, teamName: string) {
//             console.log('assignUser', userName, teamName);
//             const user = await this.database.query(User).filter({ name: userName }).findOne();
//             const team = await this.database.query(Team).filter({ name: teamName }).findOne();
//
//             if (!user) throw new Error(`User ${userName} not found`);
//             if (!team) throw new Error(`Team ${teamName} not found`);
//
//             await this.database.persist(new UserTeam(team, user));
//         }
//
//         @rpc.action()
//         async removeTeam(teamName: string) {
//             const team = await this.database.query(Team).filter({ name: teamName }).findOne();
//             if (!team) throw new Error(`Team ${teamName} not found`);
//
//             await this.database.query(Team).filter({ id: team.id }).deleteOne();
//         }
//
//         @rpc.action()
//         async find(teamName: string): Promise<Collection<User>> {
//             const collection = await this.liveDatabase.query(User)
//                 .useInnerJoin('teams')
//                 .filter({ name: { $parameter: 'teamName' } })
//                 .end()
//                 .parameter('teamName', teamName)
//                 .find();
//
//             return collection;
//         }
//     }
//
//     const testing = createTestingApp({ controllers: [TestController] }, [User, Team, UserTeam]);
//     await testing.startServer();
//     const client = testing.createRpcClient();
//     const controller = client.controller<TestController>('test');
//
//     await controller.init();
//
//     const marieId = await controller.getUserId('Marie');
//
//     // {
//     //     for (let i = 0; i < 50; i++) {
//     //         const teamMembers = await test.find('Team a');
//     //         expect(teamMembers.count()).toBe(3);
//     //         await teamMembers.unsubscribe();
//     //     }
//     // }
//
//     {
//         const teamMembers = await controller.find('Team a');
//         expect(teamMembers.count()).toBe(3);
//         console.log('members loaded');
//
//         console.log('apply Team B');
//         await teamMembers.setParameter('teamName', 'Team b').apply();
//         console.log('Team B loaded');
//         expect(teamMembers.count()).toBe(1);
//         expect(teamMembers.all()[0].id).toBe(marieId);
//         await teamMembers.unsubscribe();
//     }
//
//     {
//         const teamMembers = await controller.find('Team a');
//         console.log('members loaded');
//         expect(teamMembers.count()).toBe(3);
//         expect(teamMembers.get(marieId)).toBeUndefined();
//
//         await controller.assignUser('Marie', 'Team a');
//         await teamMembers.nextStateChange;
//         console.log('marie assigned', marieId, teamMembers.get(marieId));
//         expect(teamMembers.count()).toBe(4);
//         expect(teamMembers.get(marieId)).toBeInstanceOf(User);
//         expect(teamMembers.get(marieId)!.name).toBe('Marie');
//
//         console.log('marie unassign ...');
//         controller.unAssignUser('Marie', 'Team a');
//         await teamMembers.nextStateChange;
//         console.log('marie unassigned');
//         expect(teamMembers.count()).toBe(3);
//         expect(teamMembers.get(marieId)).toBeUndefined();
//
//         controller.removeTeam('Team a');
//         await teamMembers.nextStateChange;
//         console.log('Team deleted');
//         expect(teamMembers.count()).toBe(0);
//         expect(teamMembers.get(marieId)).toBeUndefined();
//         teamMembers.unsubscribe();
//     }
// });
