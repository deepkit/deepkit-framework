# 会话 / 工作单元

会话类似于一个工作单元。它会跟踪你所做的一切，并在调用 `commit()` 时自动记录更改。它是执行数据库更改的首选方式，因为它以一种非常快速的方式将语句打包。会话非常轻量，例如，可以在请求-响应生命周期中轻松创建。

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {

    @entity.name('user')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
    await database.migrate();

    const session = database.createSession();
    session.add(new User('User1'), new User('User2'), new User('User3'));

    await session.commit();

    const users = await session.query(User).find();
    console.log(users);
}

main();
```

使用 `session.add(T)` 将新实例添加到会话，或使用 `session.remove(T)` 移除现有实例。完成对 Session 对象的使用后，只需在所有地方取消对它的引用，以便垃圾回收器可以将其回收。

通过 Session 对象获取的实体实例，其更改会被自动检测。

```typescript
const users = await session.query(User).find();
for (const user of users) {
    user.name += ' changed';
}

await session.commit();//保存所有用户
```

## 标识映射

会话提供标识映射，确保每个数据库记录只对应一个 JavaScript 对象。比如，如果你在同一个会话中两次运行 `session.query(User).find()`，你会得到两个不同的数组，但其中包含相同的实体实例。

如果你使用 `session.add(entity1)` 添加了一个新实体，然后再次获取它，你会得到完全相同的实体实例 `entity1`。

重要提示：一旦开始使用会话，你应使用其 `session.query` 方法而不是 `database.query`。只有会话查询启用了标识映射功能。

## 变更检测

## 请求/响应