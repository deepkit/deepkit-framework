import { Website } from './website.js';
import { SQLiteDatabase, User } from '../database.js';

async function Title(props: { title: string }) {
    return <h1>{props.title}</h1>;
}

export async function UserList(props: { error?: string }, children: any, database: SQLiteDatabase) {
    const users = await database.query(User).select('username', 'created', 'id').find();

    return <Website title="Users">
        <div class="image">
            <img src="/deepkit_black.svg" style="max-width: 100%"/>
        </div>

        <Title title="Users"/>

        <table class="pretty">
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Created</th>
            </tr>
            {users.map(user => <tr>
                <td>#{user.id}</td>
                <td><strong>{user.username}</strong></td>
                <td>{user.created.toDateString()}</td>
                <td><img class="user-image" src={'/image/' + user.id}/></td>
            </tr>)}
        </table>

        <form action="/add" method="post" enctype="multipart/form-data">
            <h4>New user</h4>

            <div class="form-row">
                <label>Username</label>
                <input type="text" name="username"/><br/>
            </div>

            <div class="form-row">
                <label>Image</label>
                <input type="file" name="imageUpload"/><br/>
            </div>

            {props.error ? <div style="color: red">Error: {props.error}</div> : ''}

            <button>Send</button>
        </form>
    </Website>;
}
