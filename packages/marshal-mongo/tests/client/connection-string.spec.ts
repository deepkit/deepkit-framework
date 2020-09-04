import 'jest';
import {MongoClientConfig} from '../../src/client/client';

test('connection string basic', async () => {
    {
        const config = new MongoClientConfig('mongodb://localhost');
        expect(config.defaultDb).toBe('');
        expect(await config.getHosts()).toMatchObject([{hostname: 'localhost', port: 27017}]);
    }

    {
        const config = new MongoClientConfig('mongodb://localhost/defaultDb');
        expect(config.defaultDb).toBe('defaultDb');
        expect(await config.getHosts()).toMatchObject([{hostname: 'localhost', port: 27017}]);
    }

    {
        const config = new MongoClientConfig('mongodb://localhost/defaultDb?connectTimeoutMS=1233');
        expect(config.defaultDb).toBe('defaultDb');
        expect(await config.getHosts()).toMatchObject([{hostname: 'localhost', port: 27017}]);
    }
});

test('connection string password', async () => {
    {
        const config = new MongoClientConfig('mongodb://myDBReader:D1fficultP%40ssw0rd@localhost');
        expect(config.defaultDb).toBe('');
        expect(config.authUser).toBe('myDBReader');
        expect(config.authPassword).toBe('D1fficultP@ssw0rd');
    }
});


test('connection string options', async () => {
    {
        const config = new MongoClientConfig('mongodb://localhost/db?authSource=peter');
        expect(config.options.authSource).toBe('peter');
        expect(config.getAuthSource()).toBe('peter');
        expect(config.options.readPreference).toBe('primary');
    }
    {
        const config = new MongoClientConfig('mongodb://localhost/db?authSource=peter&readPreference=primaryPreferred');
        expect(config.getAuthSource()).toBe('peter');
        expect(config.options.readPreference).toBe('primaryPreferred');
    }
});

test('connection string basic, replica set', async () => {
    {
        const config = new MongoClientConfig('mongodb://localhost,127.0.0.1,mongo.com:26655');
        expect(config.defaultDb).toBe('');
        expect(await config.getHosts()).toMatchObject([
            {hostname: 'localhost', port: 27017},
            {hostname: '127.0.0.1', port: 27017},
            {hostname: 'mongo.com', port: 26655},
        ]);
    }
    {
        const config = new MongoClientConfig('mongodb://localhost:26622,127.0.0.1,mongo.com:26655/defaultDb');
        expect(config.defaultDb).toBe('defaultDb');
        expect(await config.getHosts()).toMatchObject([
            {hostname: 'localhost', port: 26622},
            {hostname: '127.0.0.1', port: 27017},
            {hostname: 'mongo.com', port: 26655},
        ]);
    }
});

test('connection string isSrv', async () => {
    {
        const config = new MongoClientConfig('mongodb+srv://example.com');
        expect(config.defaultDb).toBe('');
        expect(config.isSrv).toBe(true);
        expect(config.srvDomain).toBe('example.com');

        expect(await config.getHosts()).toEqual([]);
    }
});