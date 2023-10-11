# Deepkit Google Storage Storage adapter

```typescript
import { Storage } from '@deepkit/filesystem';
import { StorageGoogleAdapter } from '@deepkit/filesystem-google';

const storage = new Storage(new StorageGoogleAdapter({
    bucket: 'my-bucket',
    path: 'my-path/',
    projectId: 'my-project-id',
    
    keyFilename: '/path/to/keyfile.json',
    //or
    credentials: {
        client_email: '...',
        private_key: '...',
    }
}));

const files = await storage.files();
await storage.write('test.txt', 'hello world');
```
