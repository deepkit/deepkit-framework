db = db.getSiblingDB('db');
db.createUser({
    user: 'user',
    pwd: 'password',
    roles: [{ role: 'readWrite', db: 'db' }],
});
