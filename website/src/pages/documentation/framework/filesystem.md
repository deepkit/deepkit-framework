# Filesystem Integration

Deepkit Framework provides a powerful filesystem abstraction that allows you to work with different storage backends through a unified interface. This enables easy switching between local filesystem, cloud storage, and in-memory storage.

## Overview

The filesystem integration provides:

- **Unified API** for different storage backends
- **Named filesystems** for multiple storage systems
- **Dependency injection** integration
- **Testing support** with in-memory adapters
- **Type-safe** file operations

## Basic Filesystem Usage

### Default Filesystem Provider

Set up a default filesystem:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { Filesystem, FilesystemLocalAdapter, provideFilesystem } from '@deepkit/filesystem';

const app = new App({
    providers: [
        provideFilesystem(new FilesystemLocalAdapter('/path/to/storage'))
    ],
    imports: [new FrameworkModule()]
});
```

### Using Filesystem in Services

Inject and use the filesystem:

```typescript
import { Filesystem } from '@deepkit/filesystem';

class FileService {
    constructor(private fs: Filesystem) {}
    
    async saveFile(path: string, content: string): Promise<void> {
        await this.fs.write(path, content);
    }
    
    async readFile(path: string): Promise<string> {
        return await this.fs.readAsText(path);
    }
    
    async fileExists(path: string): Promise<boolean> {
        return await this.fs.exists(path);
    }
    
    async deleteFile(path: string): Promise<void> {
        await this.fs.delete(path);
    }
    
    async listFiles(directory: string): Promise<string[]> {
        const files = await this.fs.files(directory);
        return files.map(file => file.path);
    }
}
```

## Named Filesystems

Use multiple filesystems for different purposes:

```typescript
import { 
    provideNamedFilesystem, 
    NamedFilesystem,
    FilesystemLocalAdapter,
    FilesystemS3Adapter 
} from '@deepkit/filesystem';

const app = new App({
    providers: [
        // Local filesystem for temporary files
        provideNamedFilesystem('temp', new FilesystemLocalAdapter('/tmp')),
        
        // S3 for permanent storage
        provideNamedFilesystem('storage', new FilesystemS3Adapter({
            bucket: 'my-bucket',
            region: 'us-east-1'
        })),
        
        // Local filesystem for uploads
        provideNamedFilesystem('uploads', new FilesystemLocalAdapter('/uploads'))
    ],
    imports: [new FrameworkModule()]
});
```

### Using Named Filesystems

```typescript
import { NamedFilesystem } from '@deepkit/filesystem';

class DocumentService {
    constructor(
        @NamedFilesystem('storage') private storage: Filesystem,
        @NamedFilesystem('temp') private temp: Filesystem
    ) {}
    
    async processDocument(documentData: Buffer): Promise<string> {
        // Save to temporary storage first
        const tempPath = `temp-${Date.now()}.pdf`;
        await this.temp.write(tempPath, documentData);
        
        try {
            // Process the document
            const processedData = await this.processFile(tempPath);
            
            // Save to permanent storage
            const permanentPath = `documents/${this.generateId()}.pdf`;
            await this.storage.write(permanentPath, processedData);
            
            return permanentPath;
        } finally {
            // Clean up temporary file
            await this.temp.delete(tempPath);
        }
    }
    
    async getDocument(path: string): Promise<Buffer> {
        return await this.storage.read(path);
    }
}
```

## File Operations

### Reading Files

```typescript
class FileReader {
    constructor(private fs: Filesystem) {}
    
    async readTextFile(path: string): Promise<string> {
        return await this.fs.readAsText(path);
    }
    
    async readBinaryFile(path: string): Promise<Buffer> {
        return await this.fs.read(path);
    }
    
    async readJsonFile<T>(path: string): Promise<T> {
        const content = await this.fs.readAsText(path);
        return JSON.parse(content);
    }
    
    async streamFile(path: string): Promise<ReadableStream> {
        return await this.fs.readAsStream(path);
    }
}
```

### Writing Files

```typescript
class FileWriter {
    constructor(private fs: Filesystem) {}
    
    async writeTextFile(path: string, content: string): Promise<void> {
        await this.fs.write(path, content);
    }
    
    async writeBinaryFile(path: string, data: Buffer): Promise<void> {
        await this.fs.write(path, data);
    }
    
    async writeJsonFile(path: string, data: any): Promise<void> {
        const content = JSON.stringify(data, null, 2);
        await this.fs.write(path, content);
    }
    
    async appendToFile(path: string, content: string): Promise<void> {
        const existing = await this.fs.exists(path) 
            ? await this.fs.readAsText(path) 
            : '';
        await this.fs.write(path, existing + content);
    }
}
```

### File Management

```typescript
class FileManager {
    constructor(private fs: Filesystem) {}
    
    async copyFile(source: string, destination: string): Promise<void> {
        const data = await this.fs.read(source);
        await this.fs.write(destination, data);
    }
    
    async moveFile(source: string, destination: string): Promise<void> {
        await this.copyFile(source, destination);
        await this.fs.delete(source);
    }
    
    async createDirectory(path: string): Promise<void> {
        // Most adapters handle directory creation automatically
        await this.fs.write(`${path}/.keep`, '');
    }
    
    async getFileInfo(path: string) {
        const file = await this.fs.get(path);
        return {
            path: file.path,
            size: file.size,
            lastModified: file.lastModified,
            exists: await this.fs.exists(path)
        };
    }
    
    async listDirectory(path: string) {
        const files = await this.fs.files(path);
        return files.map(file => ({
            name: file.name,
            path: file.path,
            size: file.size,
            isDirectory: file.isDirectory,
            lastModified: file.lastModified
        }));
    }
}
```

## File Upload Handling

Handle file uploads with filesystem integration:

```typescript
import { http, HttpFile } from '@deepkit/http';

class UploadController {
    constructor(
        @NamedFilesystem('uploads') private uploads: Filesystem
    ) {}
    
    @http.POST('/upload')
    async uploadFile(@http.body() file: HttpFile): Promise<{ path: string }> {
        const filename = `${Date.now()}-${file.name}`;
        const path = `uploads/${filename}`;
        
        await this.uploads.write(path, file.buffer);
        
        return { path };
    }
    
    @http.POST('/upload-multiple')
    async uploadMultipleFiles(@http.body() files: HttpFile[]): Promise<{ paths: string[] }> {
        const paths: string[] = [];
        
        for (const file of files) {
            const filename = `${Date.now()}-${file.name}`;
            const path = `uploads/${filename}`;
            
            await this.uploads.write(path, file.buffer);
            paths.push(path);
        }
        
        return { paths };
    }
    
    @http.GET('/download/:filename')
    async downloadFile(@http.param() filename: string): Promise<Buffer> {
        const path = `uploads/${filename}`;
        
        if (!await this.uploads.exists(path)) {
            throw new Error('File not found');
        }
        
        return await this.uploads.read(path);
    }
}
```

## Image Processing

Combine filesystem with image processing:

```typescript
import sharp from 'sharp';

class ImageService {
    constructor(
        @NamedFilesystem('images') private images: Filesystem
    ) {}
    
    async processAndSaveImage(imageData: Buffer, filename: string): Promise<string[]> {
        const paths: string[] = [];
        
        // Save original
        const originalPath = `original/${filename}`;
        await this.images.write(originalPath, imageData);
        paths.push(originalPath);
        
        // Create thumbnail
        const thumbnailData = await sharp(imageData)
            .resize(200, 200)
            .jpeg({ quality: 80 })
            .toBuffer();
        
        const thumbnailPath = `thumbnails/${filename}`;
        await this.images.write(thumbnailPath, thumbnailData);
        paths.push(thumbnailPath);
        
        // Create medium size
        const mediumData = await sharp(imageData)
            .resize(800, 600)
            .jpeg({ quality: 90 })
            .toBuffer();
        
        const mediumPath = `medium/${filename}`;
        await this.images.write(mediumPath, mediumData);
        paths.push(mediumPath);
        
        return paths;
    }
    
    async getImageVariant(filename: string, variant: 'original' | 'thumbnail' | 'medium'): Promise<Buffer> {
        const path = `${variant}/${filename}`;
        return await this.images.read(path);
    }
}
```

## Configuration Management

Use filesystem for configuration files:

```typescript
class ConfigManager {
    constructor(
        @NamedFilesystem('config') private configFs: Filesystem
    ) {}
    
    async loadConfig<T>(name: string): Promise<T> {
        const path = `${name}.json`;
        
        if (!await this.configFs.exists(path)) {
            throw new Error(`Configuration file ${name} not found`);
        }
        
        const content = await this.configFs.readAsText(path);
        return JSON.parse(content);
    }
    
    async saveConfig(name: string, config: any): Promise<void> {
        const path = `${name}.json`;
        const content = JSON.stringify(config, null, 2);
        await this.configFs.write(path, content);
    }
    
    async listConfigs(): Promise<string[]> {
        const files = await this.configFs.files('.');
        return files
            .filter(file => file.name.endsWith('.json'))
            .map(file => file.name.replace('.json', ''));
    }
}
```

## Testing with Filesystem

Use in-memory filesystem for testing:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { FilesystemMemoryAdapter, provideFilesystem } from '@deepkit/filesystem';

test('file operations', async () => {
    const testing = createTestingApp({
        providers: [
            provideFilesystem(new FilesystemMemoryAdapter()),
            FileService
        ]
    });
    
    const fileService = testing.app.get(FileService);
    
    // Test file operations
    await fileService.saveFile('test.txt', 'Hello World');
    
    const content = await fileService.readFile('test.txt');
    expect(content).toBe('Hello World');
    
    const exists = await fileService.fileExists('test.txt');
    expect(exists).toBe(true);
    
    await fileService.deleteFile('test.txt');
    
    const existsAfterDelete = await fileService.fileExists('test.txt');
    expect(existsAfterDelete).toBe(false);
});

test('named filesystems', async () => {
    const testing = createTestingApp({
        providers: [
            provideNamedFilesystem('temp', new FilesystemMemoryAdapter()),
            provideNamedFilesystem('storage', new FilesystemMemoryAdapter()),
            DocumentService
        ]
    });
    
    const documentService = testing.app.get(DocumentService);
    
    const documentData = Buffer.from('PDF content');
    const path = await documentService.processDocument(documentData);
    
    expect(path).toMatch(/^documents\/.*\.pdf$/);
    
    const retrievedData = await documentService.getDocument(path);
    expect(retrievedData).toEqual(documentData);
});
```

## Error Handling

Handle filesystem errors gracefully:

```typescript
class RobustFileService {
    constructor(private fs: Filesystem) {}
    
    async safeReadFile(path: string): Promise<string | null> {
        try {
            return await this.fs.readAsText(path);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File not found
            }
            throw error; // Re-throw other errors
        }
    }
    
    async safeWriteFile(path: string, content: string): Promise<boolean> {
        try {
            await this.fs.write(path, content);
            return true;
        } catch (error) {
            console.error(`Failed to write file ${path}:`, error);
            return false;
        }
    }
    
    async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
        let lastError: Error;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }
        
        throw lastError!;
    }
}
```

## Best Practices

1. **Use named filesystems** for different storage purposes
2. **Handle errors gracefully** with try-catch blocks
3. **Use in-memory adapters** for testing
4. **Clean up temporary files** after processing
5. **Validate file paths** to prevent directory traversal
6. **Use appropriate adapters** for your storage needs
7. **Monitor storage usage** and implement cleanup policies
8. **Implement retry logic** for network-based storage

## Available Adapters

- **FilesystemLocalAdapter**: Local filesystem storage
- **FilesystemMemoryAdapter**: In-memory storage (testing)
- **FilesystemS3Adapter**: Amazon S3 storage
- **FilesystemGoogleCloudAdapter**: Google Cloud Storage
- **FilesystemAzureAdapter**: Azure Blob Storage

## Next Steps

- [Configuration](./configuration.md) - Filesystem configuration
- [Testing](./testing.md) - Testing filesystem operations
- [Deployment](./deployment.md) - Production filesystem setup
- [Performance](../performance.md) - Filesystem performance optimization
