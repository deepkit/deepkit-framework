# Composite Primary Key

Composite Primary Key とは、ある Entity が複数の Primary Key を持ち、それらが自動的に組み合わさって「Composite Primary Key」になることを意味します。こうした database のモデリングには長所と短所があります。私たちは、Composite Primary Key は利点を正当化できないほど実務上の大きな欠点を伴うと考えており、bad practice とみなし、避けるべきだと考えます。Deepkit ORM は Composite Primary Key をサポートしていません。本章ではその理由を説明し、（より良い）代替案を示します。

## 欠点

Join は自明ではありません。RDBMS で高度に最適化されているとはいえ、アプリケーション側では一定の複雑性として存在し、すぐに手に負えなくなってパフォーマンス問題を引き起こしかねません。パフォーマンスとはクエリの実行時間だけでなく、開発時間の観点でも同様です。

## Joins

各 Join は、関与する field が増えるほど複雑になります。多くの database は複数 field の Join を必ずしも遅くしない最適化を実装していますが、開発者は常にその Join を細部まで考慮する必要があります。たとえば key を一つ忘れると（すべての key を指定しなくても Join 自体は動作するため）微妙な誤りにつながり得るので、開発者は Composite Primary Key の完全な構造を把握しておく必要があります。

## Indizes

複数 field を持つ Index（すなわち Composite Primary Key）は、クエリ内での field の順序という問題に悩まされます。database system は特定のクエリを最適化できますが、構造が複雑になると、定義済みのすべての Index を正しく活用する効率的な操作を書くことが難しくなります。複数 field の Index（Composite Primary Key のような）では、database が実際にその Index を使うために、通常は field を正しい順序で定義する必要があります。順序が正しく指定されない場合（たとえば WHERE 句で）、database が Index をまったく使わず、代わりに full table scan を行ってしまうことは容易に起こります。どの database クエリがどのように最適化されるかを知るのは高度な知識であり、通常は新しい開発者が持っているものではありません。しかし、Composite Primary Key を使い始めた時点で、database を最大限に活用し無駄なリソース消費を避けるには、その知識が必要になります。

## Migrationen

一度、特定の Entity を一意に識別するために追加の field が必要だと判断すると（その結果、それが Composite Primary Key になると）、その Entity と関係を持つ database 内のすべての Entity を調整する必要が生じます。

たとえば、Composite Primary Key を持つ `user` という Entity があり、さまざまな table でこの `user` への foreign key を使うことにしたとします。例として pivot table の `audit_log`、`groups`、`posts` などです。`user` の Primary Key を変更すると、これらすべての table も Migration で調整する必要があります。

これは Migration ファイルをはるかに複雑にするだけでなく、Migration 実行時の大きなダウンタイムを引き起こす可能性もあります。というのも schema の変更には、通常、database 全体の lock か少なくとも table lock が必要になるためです。Index 変更のような大きな変更で影響を受ける table が多いほど、Migration に要する時間は長くなります。そして table が大きいほど、Migration にかかる時間も長くなります。
`audit_log` table を考えてみましょう。こうした table は通常、多数（数百万など）の record を持ちますが、Composite Primary Key を採用し、`user` の Primary Key に field を1つ追加するという決定だけで、schema 変更の際にそれらへも手を入れなければなりません。これらすべての table のサイズによっては、Migration の変更コストが不必要に高くなるか、場合によっては `User` の Primary Key を変更することがもはや金銭的に正当化できないほど高くなることもあります。これはたいてい、user table に unique index を追加する、といった回避策につながり、technical debt を生み、遅かれ早かれ legacy のリスト行きになります。

大規模プロジェクトでは、これが非常に大きなダウンタイム（数分から数時間）につながり、場合によっては、table をコピーし、ghost table に record を挿入し、Migration 後に table を行き来させるといった、まったく新しい Migration 抽象化システムの導入にまで至ることがあります。この付加的な複雑性は、Composite Primary Key を持つ別の Entity と関係を持つすべての Entity にも波及し、database 構造が大きくなるほど増大します。この問題は（Composite Primary Key を完全に取り除く以外）解決策がなく、悪化する一方です。

## 検索容易性

あなたが database administrator や Data Engineer/Scientist であれば、通常は database に直接アクセスして、必要に応じてデータを探索します。Composite Primary Key の場合、SQL を直接書くユーザーは、関与するすべての table の正しい Primary Key（および正しい Index 最適化を得るための column の順序）を知っていなければなりません。この追加の負担は、データ探索やレポート作成などを複雑にするだけでなく、Composite Primary Key が突然変更された場合に、古い SQL にエラーを引き起こすこともあります。古い SQL はおそらく依然として有効で正常に動作しますが、Composite Primary Key に新たな field が追加されたのに join にそれが欠けているせいで、突然、誤った結果を返すようになります。ここでは Primary Key を1つだけにしておくほうがはるかに簡単です。これによりデータを見つけやすくなり、たとえば user object の一意識別の方法を変更することにしたとしても、古い SQL クエリが引き続き正しく動作することを保証できます。

## 改訂

一度、ある Entity に Composite Primary Key を使ってしまうと、key の refactoring は大規模な追加 refactoring を招く可能性があります。Composite Primary Key を持つ Entity には通常、単一の一意な field が存在しないため、すべての filter と link は Composite Key のすべての値を含める必要があります。これはたいてい、code が Composite Primary Key を知っていることに依存することを意味し、そのためすべての field を取得しなければならなくなります（例: user:key1:key2 のような URL）。この key を変更すると、URL、custom SQL クエリ、その他の場所など、この知識が明示的に使われているすべての箇所を書き換えなければなりません。

多くの ORM は通常、値を手動指定しなくても Join を自動生成しますが、URL 構造や custom SQL クエリといった他のユースケース、特にレポーティングシステムや外部システムなど ORM をまったく使っていない場所の refactoring までを自動でカバーすることはできません。

## ORM の複雑さ

Composite Primary Key をサポートすると、Deepkit ORM のような強力な ORM の code 複雑性が飛躍的に増大します。code とメンテナンスはより複雑になり、したがってより高コストになるだけでなく、ユーザーからの edge case も増え、対応と保守が必要になります。query layer、change detection、migration system、internal relationship tracking などの複雑性が大幅に増します。Composite Primary Key を備えた ORM を構築・サポートすることに伴う総コストは、あらゆる点を考慮すると高すぎて正当化できません。これが Deepkit がそれをサポートしない理由です。

## 利点

これとは別に、Composite Primary Key にも利点はありますが、非常に表層的なものです。各 table に対して可能な限り少ない Index を使うことで、書き込み（insert/update）がより効率的になります。維持すべき Index が少なくなるためです。また、model の構造も少しだけクリーンになります（通常は column が1つ少なくなるため）。しかし、逐次順序で自動増分する Primary Key と、増分しない Primary Key の差は、昨今では完全に無視できる程度です。disk space は安価であり、処理自体も通常は append-only の操作で非常に高速だからです。

確かに、いくつかの edge case（そして少数の非常に特定の database system）では、最初は Composite Primary Key で作業したほうが良いこともあるでしょう。しかし、そのような system であっても、（あらゆるコストを考慮すると）それらを使わず、別の戦略に切り替えるほうが全体として理にかなっている場合があります。

## 代替案

Composite Primary Key の代替は、単一の自動増分 numeric Primary Key（通常は「id」と呼ばれる）を使い、Composite Primary Key は複数 field の unique index に移すことです。使用する Primary Key（想定行数に依存）に応じて、「id」は1 record あたり 4 または 8 バイトを使用します。

この戦略を採用することで、前述の問題について考え、その解決策を見つけることを強制されなくなり、成長し続けるプロジェクトのコストを大幅に削減できます。

この戦略は具体的には、各 Entity に「id」field があり、通常は一番最初に置かれ、この field が既定で一意行の識別および Join に使われることを意味します。

```typescript
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(public username: string) {}
}
```

Composite Primary Key の代替として、代わりに複数 field の unique index を使用します。

```typescript
@entity.index(['tenancyId', 'username'], {unique: true})
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        public tenancyId: number,
        public username: string,
    ) {}
}
```

Deepkit ORM は MongoDB を含め、自動増分の Primary Key を自動的にサポートします。これは database 内の record を識別するための推奨方法です。ただし MongoDB では、単純な Primary Key として ObjectId（`_id: MongoId & PrimaryKey = ''`）を使用できます。自動増分 numeric Primary Key の代替として UUID もあり、同様に機能します（ただし、indexing が高コストになるためパフォーマンス特性はやや異なります）。

## まとめ

Composite Primary Key は本質的に、一度導入すると、その後のあらゆる変更と実務での利用コストが大幅に高くなることを意味します。最初は（column が1つ少ないため）クリーンなアーキテクチャに見えるものの、プロジェクトを実際に開発し始めると実務コストは顕著になり、プロジェクトが大きくなるにつれてコストは増え続けます。

利点と欠点の非対称性を見れば、ほとんどの場合 Composite Primary Key は正当化できないことは明らかです。コストは利点をはるかに上回ります。あなたというユーザーにとってだけでなく、ORM の code の作者およびメンテナとしての私たちにとっても同様です。このため、Deepkit ORM は Composite Primary Key をサポートしません。