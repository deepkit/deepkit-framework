print('START #################################################################');

var list = ["db"];

for(var i = 0; i < list.length; i++) {
    var name = list[i];
    db = db.getSiblingDB(name);
    db.createUser(
        {
            user: 'user',
            pwd: 'password',
            roles: [{ role: 'readWrite', db: name }],
        },
    );
}

print('END #################################################################');
