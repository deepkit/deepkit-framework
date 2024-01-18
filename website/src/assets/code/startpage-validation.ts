type Username = string & Unique & MinLength<4>;

interface User {
    id: number & Positive;
    created: Date;
    username: Username;
    email?: Email;
    firstName?: string;
}

is<User>({
    id: 1, username: 'Peter',
    created: new Date
}); //true, automatic runtime type guard

cast<User>({
    id: '2', username: 'Peter',
    created: '2023-09-15T14:24:06.439Z'
}); //{id: 2, username: 'Peter', ...}
