# プロバイダ

Dependency Injection コンテナに依存関係を提供する方法はいくつかあります。最も単純な方法は、クラスを指定するだけです。これは短縮形の ClassProvider とも呼ばれます。

```typescript
new App({
    providers: [UserRepository]
});
```

これはクラスのみを指定する特別なプロバイダを表します。その他のプロバイダはすべてオブジェクトリテラルとして指定する必要があります。

デフォルトでは、すべてのプロバイダはシングルトンとしてマークされ、常に 1 つのインスタンスのみが存在します。プロバイダの解決ごとに新しいインスタンスを作成したい場合は、`transient` オプションを使用します。これにより、クラスは毎回再生成され、またはファクトリは毎回実行されます。

```typescript
new App({
    providers: [{ provide: UserRepository, transient: true }]
});
```

## ClassProvider

短縮形の ClassProvider のほかに、通常の ClassProvider もあり、こちらはクラスではなくオブジェクトリテラルです。

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: UserRepository }]
});
```

これは次の 2 つと同等です:

```typescript
new App({
    providers: [{ provide: UserRepository }]
});

new App({
    providers: [UserRepository]
});
```

これを使って、あるプロバイダを別のクラスに置き換えることができます。

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: OtherUserRepository }]
});
```

この例では、`OtherUserRepository` クラスも DI コンテナで管理され、すべての依存関係が自動的に解決されます。

## ValueProvider

静的な値をこのプロバイダで提供できます。

```typescript
new App({
    providers: [{ provide: OtherUserRepository, useValue: new OtherUserRepository() }]
});
```

依存関係として提供できるのはクラスインスタンスだけではないため、`useValue` には任意の値を指定できます。プロバイダトークンとしてシンボルやプリミティブ（string、number、boolean）を使用することもできます。

```typescript
new App({
    providers: [{ provide: 'domain', useValue: 'localhost' }]
});
```

プリミティブなプロバイダトークンは、依存関係として Inject 型で宣言する必要があります。

```typescript
import { Inject } from '@deepkit/core';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

inject エイリアスとプリミティブなプロバイダトークンの組み合わせは、実行時の型情報を含まないパッケージから依存関係を提供する場合にも使用できます。

```typescript
import { Inject } from '@deepkit/core';
import { Stripe } from 'stripe';

export type StripeService = Inject<Stripe, '_stripe'>;

new App({
    providers: [{ provide: '_stripe', useValue: new Stripe }]
});
```

そして、利用側では次のように宣言します:

```typescript
class PaymentService {
    constructor(public stripe: StripeService) {}
}
```

## ExistingProvider

既に定義済みのプロバイダへのフォワーディングを定義できます。

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useValue: new OtherUserRepository()},
        {provide: UserRepository, useExisting: OtherUserRepository}
    ]
});
```

## FactoryProvider

関数を使用してプロバイダに値を提供できます。この関数はパラメータを取ることもでき、そのパラメータは DI コンテナから提供されます。これにより、他の依存関係や設定オプションにアクセスできます。

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useFactory: () => {
            return new OtherUserRepository()
        }},
    ]
});

new App({
    providers: [
        {provide: OtherUserRepository, useFactory: (domain: RootConfiguration['domain']) => {
            return new OtherUserRepository(domain);
        }},
    ]
});

new App({
    providers: [
        Database,
        {provide: OtherUserRepository, useFactory: (database: Database) => {
            return new OtherUserRepository(database);
        }},
    ]
});
```

## InterfaceProvider

クラスやプリミティブに加えて、抽象（インターフェース）も提供できます。これは `provide` 関数を介して行い、提供する値が型情報を含まない場合に特に有用です。

```typescript
import { provide } from '@deepkit/injector';

interface Connection {
    write(data: Uint16Array): void;
}

class Server {
   constructor (public connection: Connection) {}
}

class MyConnection {
    write(data: Uint16Array): void {}
}

new App({
    providers: [
        Server,
        provide<Connection>(MyConnection)
    ]
});
```

複数のプロバイダが Connection インターフェースを実装している場合、最後のプロバイダが使用されます。

provide() の引数としては、他のすべての種類のプロバイダを指定できます。

```typescript
const myConnection = {write: (data: any) => undefined};

new App({
    providers: [
        provide<Connection>({ useValue: myConnection })
    ]
});

new App({
    providers: [
        provide<Connection>({ useFactory: () => myConnection })
    ]
});
```

## 非同期プロバイダ

`@deepkit/injector` の設計上、非同期の Dependency Injection コンテナにおける非同期プロバイダの使用は想定されていません。これは、プロバイダの要求も非同期である必要があり、アプリケーション全体を最上位レベルで非同期として動作させる必要があるためです。

何かを非同期に初期化する必要がある場合、その初期化はアプリケーションサーバーのブートストラップに移すべきです。そこではイベントを非同期にできます。あるいは、初期化を手動でトリガーすることもできます。

## プロバイダの構成

構成コールバックを使用すると、プロバイダの結果を操作できます。これは、別の依存性注入の手法であるメソッドインジェクションを用いる場合などに便利です。

これらは module API または app API でのみ使用でき、モジュールの上位で登録されます。

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.setDatabase(db);
});
```

`configureProvider` はコールバックの第 1 引数 `v` として UserRepository のインスタンスを受け取り、そのメソッドを呼び出せます。

メソッド呼び出しに加えて、プロパティの設定も可能です。

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.db = new Database();
});
```

すべてのコールバックはキューに格納され、定義された順序で実行されます。

キュー内の呼び出しは、プロバイダが作成され次第、その実際の結果に対して実行されます。つまり、ClassProvider ではインスタンス生成直後のクラスインスタンスに適用され、FactoryProvider ではファクトリの戻り値に適用され、ValueProvider ではその値自体に適用されます。

静的な値だけでなく他のプロバイダも参照するために、コールバックの引数として定義するだけで任意の依存関係を注入できます。これらの依存関係がプロバイダのスコープで解決可能であることを確認してください。

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.configureProvider<UserRepository>((v, db: Database) => {
  v.db = db;
});
```

## 名目型

`configureProvider` に渡される型（前の例の `UserRepository` など）は、構造的型付けではなく名目型によって解決されることに注意してください。これは、同じ構造でも異なるアイデンティティを持つ 2 つのクラス/インターフェースは互換ではないことを意味します。これは `get<T>` の呼び出しや依存関係の解決時にも同様です。 

これは構造的型付けに基づく TypeScript の型チェックの方式とは異なります。この設計判断は、偶発的な誤設定（例: 任意のクラスと構造的に互換な空のクラスを要求してしまう等）を避け、コードをより堅牢にするためのものです。


次の例では `User1` と `User2` クラスは構造的には互換ですが、名目的には互換ではありません。つまり、`User1` を要求しても `User2` は解決されず、その逆も同様です。

```typescript

class User1 {
    name: string = '';
}

class User2 {
    name: string = '';
}

new App({
    providers: [User1, User2]
});
```

クラスの継承やインターフェースの実装は、名目的な関係を確立します。

```typescript
class UserBase {
    name: string = '';
}

class User extends UserBase {
}

const app = new App({
    providers: [User2]
});

app.get(UserBase); // User を返す
```

```typescript
interface UserInterface {
    name: string;
}

class User implements UserInterface {
    name: string = '';
}

const app = new App({
    providers: [User]
});

app.get<UserInterface>(); // User を返す
```