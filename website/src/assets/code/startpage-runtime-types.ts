type status = 'pending' | 'running' | 'finished';
// ['pending', 'running', 'finished']
valuesOf<status>();

interface User {
    id: integer & PrimaryKey;
    created: Date;
    username: string & MinLength<3> & Unique;
    email: Email;
    firstName?: string;
    lastName?: string;
}

// Full access to all computed type information
const reflection = ReflectionClass.from<User>();

// Type information of arbitrary type expressions
// {kind: ReflectionKind.class, types: [...]
type CreateUser = Omit<User, 'id'>;
typeOf<CreateUser>();
