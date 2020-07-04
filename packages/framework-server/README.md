## Glut.ts Server

Installation:

```
npm install @super-hornet/framework-server @super-hornet/framework-core reflect-metadata rxjs buffer
```

#### Server

Example

```typescript

@Controller('user')
class UserController implements UserControllerInterface{

    @Action()
    names(): string {
        return ['name1', 'name2'];
    }
    
    @Action()
    users(): Observable<User> {
        return new Observable((observer) => {
            observer.next(new User('Peter 1'));
            
            setTimeout(() =>{
                observer.next(new User('Peter 2'));
                observer.complete();
            }, 1000);
        });
    }
    
    @Action()
    userList(): Collection<User> {
        const collection = new Collection(User);
        collection.add(new User('Peter 1'));
        collection.add(new User('Peter 2'));
        collection.add(new User('Peter 3'));
        collection.loaded();
        
        setTimeout(() => {
            //whenever you change the collection, we send the operations to the client
            //and keep everything in sync
            collection.add(new User('Peter 4'));
        }, 1000);
        
        return collection;
    }
}

@ApplicationModule({
    controllers: [UserController],
    connectionProviders: [],
    notifyEntities: [User],
})
class MyApp extends Application {
    async bootstrap(): Promise<any> {
        await super.bootstrap();
        console.log('bootstrapped =)');
    }

    async authenticate(token: any): Promise<Session> {
        console.log('authenticate', token);
        return super.authenticate(token);
    }
}

const app = ApplicationServer.createForModule(MyApp);
app.start();
```
