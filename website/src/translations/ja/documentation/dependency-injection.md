# 依存性注入

Dependency Injection (DI) は、Class や Function が依存関係を「_受け取る_」設計パターンです。Inversion of Control (IoC) の原則に従い、複雑なコードをよりよく分離することで、テスタビリティ、モジュール性、明確性を大幅に向上させます。IoC の原則を適用するためのデザインパターンとしてはサービスロケーターパターンなどもありますが、特にエンタープライズソフトウェアにおいては、DI が支配的なパターンとして確立されています。

IoC の原則を説明するために、次の例を示します。

```typescript
import { HttpClient } from 'http-library';

class UserRepository {
    async getUsers(): Promise<Users> {
        const client = new HttpClient();
        return await client.get('/users');
    }
}
```

UserRepository Class は依存関係として HttpClient を持っています。この依存関係自体は特筆すべきものではありませんが、`UserRepository` が自分自身で HttpClient を生成していることが問題です。
HttpClient の生成を UserRepository の中にカプセル化するのは良い考えのように思えるかもしれませんが、実はそうではありません。もし HttpClient を差し替えたい場合はどうでしょうか？実際の HTTP リクエストが外部に出ていかないようにして UserRepository をユニットテストしたい場合はどうでしょうか？この Class がそもそも HttpClient を使用していることを、どのようにして知るのでしょうか？

## Inversion of Control

Inversion of Control (IoC) の考え方では、HttpClient をコンストラクターで明示的な依存関係として受け取る（コンストラクターインジェクションとも呼ばれる）次のような別案があります。

```typescript
class UserRepository {
    constructor(
        private http: HttpClient
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

これで UserRepository は HttpClient を生成する責任を持たず、UserRepository の利用者がその責任を負います。これが Inversion of Control (IoC) です。制御が反転（逆転）しました。具体的には、このコードは依存性注入を適用しています。依存関係は受け取られ（注入され）、もはや自分で生成したり要求したりしません。Dependency Injection は IoC の一つの変種にすぎません。

## Service Locator

DI とは別に、Service Locator (SL) も IoC の原則を適用する方法です。これは依存関係を受け取るのではなく要求するため、一般的に Dependency Injection の対極と見なされます。もし上記コードで HttpClient を次のように要求した場合、これは Service Locator パターンと呼ばれます。

```typescript
class UserRepository {
    async getUsers(): Promise<Users> {
        const client = locator.getHttpClient();
        return await client.get('/users');
    }
}
```

`locator.getHttpClient` という Function は任意の名前を持てます。代替案としては、`useContext(HttpClient)`, `getHttpClient()`, `await import("client")` のような呼び出しや、`container.get(HttpClient)` や `container.http` のようなコンテナへの問い合わせがあります。グローバルの import はサービスロケーターの少し異なる変種で、モジュールシステム自体をロケーターとして使用します。

```typescript
import { httpClient } from 'clients'

class UserRepository {
    async getUsers(): Promise<Users> {
        return await httpClient.get('/users');
    }
}
```

これらの変種に共通しているのは、HttpClient という依存関係を明示的に要求し、コードがサービスコンテナの存在を知っているという点です。これはコードをフレームワークに強く結びつけ、コードをクリーンに保つためには避けたいものです。

サービスの要求は、Property のデフォルト値としてだけでなく、コードの途中のどこかでも発生しえます。コードの途中ということは Type の Interface の一部ではないため、HttpClient の使用が隠蔽されます。HttpClient の要求方法のバリエーションによっては、別の実装に置き換えることが非常に難しかったり、完全に不可能な場合もあります。特にユニットテストの領域や明確さのために、ここで困難が生じることがあり、そのためサービスロケーターは状況によってはアンチパターンと分類されます。

## Dependency Injection

Dependency Injection では、何かを要求するのではなく、利用者によって明示的に提供されるか、コードが受け取ります。利用側はサービスコンテナにアクセスせず、`HttpClient` がどのように生成または取得されるかを知りません。本質的には、IoC フレームワークからコードを疎結合にし、よりクリーンにします。

必要なのは `HttpClient` が Type として必要だと宣言することだけです。Service Locator に対する Dependency Injection の大きな差異であり利点の一つは、Dependency Injection を使用するコードが、あらゆる種類のサービスコンテナやサービス識別システムなしでも問題なく動作することです（サービスに名前を付ける必要がありません）。これは単なる Type の宣言であり、IoC フレームワークの文脈外でも機能します。

前の例で見たように、すでに依存性注入パターンが適用されています。具体的にはコンストラクターインジェクションが見られ、依存関係がコンストラクターで宣言されています。したがって、UserRepository は次のようにインスタンス化する必要があります。

```typescript
const users = new UserRepository(new HttpClient());
```

UserRepository を使用したいコードは、その依存関係すべてを提供（注入）しなければなりません。HttpClient を毎回生成するべきか、毎回同じものを使うべきかは、Class 自身ではなく、その Class の利用者が決めます。もはや（Class の観点では）サービスロケーターの場合のように要求されることも、最初の例のように完全に自分で生成されることもありません。このフローの反転にはさまざまな利点があります。

* すべての依存関係が明示的に見えるため、コードが理解しやすくなる。
* すべての依存関係が一意で、必要に応じて簡単に差し替えられるため、テストが容易になる。
* 依存関係を簡単に交換できるため、コードがよりモジュール化される。
* UserRepository が非常に複雑な依存関係を自ら生成する責任を負わなくなるため、関心の分離 (Separation of Concern) の原則を促進する。

しかし、明らかな欠点もすぐに見えてきます。HttpClient のようなすべての依存関係を本当に自分で作成または管理する必要があるのでしょうか？答えは Yes と No です。Yes、多くのケースでは依存関係を自分で管理するのは完全に正当です。良い API の証は、依存関係が手に負えなくならないこと、そしてそうなったとしても使い心地が良いことです。多くのアプリケーションや複雑なライブラリでは、それが当てはまる場合があります。多くの依存関係を持つ非常に複雑な低レベル API を、利用者にとって簡素化して提供するには、Facade パターンが素晴らしく有効です。

## 依存性注入コンテナ

しかし、より複雑なアプリケーションでは、すべての依存関係を自分で管理する必要はありません。まさにそのために、いわゆる依存性注入コンテナが存在します。これはすべてのオブジェクトを自動的に生成するだけでなく、依存関係も自動的に「注入」するため、手動での "new" 呼び出しが不要になります。コンストラクターインジェクション、メソッドインジェクション、プロパティインジェクションなど、さまざまな種類のインジェクションがあります。これにより、多数の依存関係を持つ複雑なアーキテクチャでも容易に管理できます。

依存性注入コンテナ（DI コンテナまたは IoC コンテナとも呼ばれる）は、Deepkit では `@deepkit/injector` として提供されており、Deepkit Framework では App モジュールを通じてすでに統合されています。上記のコードは、`@deepkit/injector` パッケージの低レベル API を使用すると次のようになります。

```typescript
import { InjectorContext } from '@deepkit/injector';

const injector = InjectorContext.forProviders(
    [UserRepository, HttpClient]
);

const userRepo = injector.get(UserRepository);

const users = await userRepo.getUsers();
```

この場合の `injector` オブジェクトが依存性注入コンテナです。"new UserRepository" を使う代わりに、コンテナは `get(UserRepository)` を用いて UserRepository のインスタンスを返します。コンテナを静的に初期化するために、`InjectorContext.forProviders` Function にプロバイダーの一覧（この場合は単に Class）を渡します。
DI は依存関係を提供することがすべてなので、コンテナには依存関係が提供されます。これが「プロバイダー」という技術用語の由来です。

プロバイダーには複数の種類があります: ClassProvider, ValueProvider, ExistingProvider, FactoryProvider。これらを組み合わせることで、DI コンテナで非常に柔軟なアーキテクチャを表現できます。

プロバイダー間のすべての依存関係は自動的に解決され、`injector.get()` 呼び出しが発生した時点でオブジェクトと依存関係が生成・キャッシュされ、コンストラクター引数として正しく渡され（これがコンストラクターインジェクション）、Property として設定され（これがプロパティインジェクション）、またはメソッド呼び出しに渡されます（これがメソッドインジェクション）。

さて、HttpClient を別のものに交換するには、HttpClient に対して別のプロバイダー（ここでは ValueProvider）を定義できます。

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useValue: new AnotherHttpClient()},
]);
```

`injector.get(UserRepository)` を通じて UserRepository が要求されると、AnotherHttpClient オブジェクトを受け取ります。代わりに ClassProvider を使うのも非常に有効で、AnotherHttpClient の依存関係も DI コンテナによって管理されます。

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useClass: AnotherHttpClient},
]);
```

プロバイダーのすべての種類は、[依存性注入のプロバイダー](./dependency-injection/providers.md) セクションで一覧と説明があります。

ここで言及しておくべきは、Deepkit の DI コンテナは Deepkit のランタイム Type にのみ対応しているということです。つまり、Class、Type、Interface、Function を含むコードは、ランタイムで Type 情報を利用できるようにするために、Deepkit Type Compiler でコンパイルされる必要があります。詳しくは [ランタイム型](./runtime-types.md) の章を参照してください。

## 依存性逆転

先ほどの UserRepository の例では、UserRepository が下位レイヤーの HTTP ライブラリに依存しています。さらに、抽象 (Interface) ではなく具体的な実装 (Class) を依存関係として宣言しています。一見するとオブジェクト指向のパラダイムに沿っているように見えますが、特に複雑で大規模なアーキテクチャでは問題につながる可能性があります。

別の案としては、HttpClient の依存関係を抽象 (Interface) に変換し、UserRepository に HTTP ライブラリのコードを import しないようにすることが考えられます。

```typescript
interface HttpClientInterface {
   get(path: string): Promise<any>;
}

class UserRepository {
    concstructor(
        private http: HttpClientInterface
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

これは依存性逆転の原則と呼ばれます。UserRepository はもはや HTTP ライブラリに直接依存せず、抽象（Interface）に基づきます。これにより、この原則の二つの基本的な目標を満たします。

* 高水準モジュールは低水準モジュールから何も import すべきではない。
* 実装は抽象（Interface）に基づくべきである。

二つの実装（HTTP ライブラリを用いた UserRepository）の統合は、DI コンテナを通じて行えます。

```typescript
import { InjectorContext } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    HttpClient,
]);
```

Deepkit の DI コンテナは HttpClientInterface のような抽象的な依存関係（Interface）を解決できるため、HttpClient が HttpClientInterface を実装している限り、UserRepository は自動的に HttpClient の実装を取得します。

これは、HttpClient が明示的に HttpClientInterface を実装する（`class HttpClient implements HttpClientInterface`）か、あるいは HttpClient の API が単に HttpClientInterface と互換であることによって実現されます。

HttpClient が API を変更（たとえば `get` Method を削除）して HttpClientInterface と互換でなくなった時点で、DI コンテナは Error を投げます（"the HttpClientInterface dependency was not provided"）。ここでは、両方の実装を結びつけたい利用者が解決策を見つける責任を負います。例としては、HttpClientInterface を実装し、Method 呼び出しを正しく HttpClient に中継するアダプター Class を登録することが挙げられます。

代替として、HttpClientInterface に具体的な実装を直接提供することもできます。

```typescript
import { InjectorContext, provide } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository, HttpClientInterface } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    provide<HttpClientInterface>({useClass: HttpClient}),
]);
```

ここで注意すべきは、理論的には依存性逆転の原則に利点がある一方で、実践では大きな欠点もあるということです。より多くの Interface を記述しなければならないためコード量が増えるだけでなく、各実装が依存関係ごとに Interface を持つことになるため、複雑性も増します。このコストを支払う価値があるのは、アプリケーションが一定の規模に達し、この柔軟性が必要になったときだけです。あらゆるデザインパターンや原則には費用対効果があり、適用する前に熟考すべきです。

デザインパターンは、最も単純なコードにまで闇雲に一律適用すべきではありません。しかし、複雑なアーキテクチャ、大規模アプリケーション、拡大するチームといった前提条件が揃っているならば、依存性逆転やその他のデザインパターンこそが真価を発揮します。