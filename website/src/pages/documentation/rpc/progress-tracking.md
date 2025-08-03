# Progress Tracking

## Understanding RPC Progress Tracking

Progress tracking in RPC systems addresses a critical user experience challenge: providing feedback during long-running operations or large data transfers. Without progress information, users are left wondering if their operation is working, how long it will take, or if it has failed. Deepkit RPC's automatic progress tracking provides real-time feedback for any operation that involves significant data transfer.

### Why Progress Tracking Matters

Modern applications handle increasingly large amounts of data:

- **File Uploads**: Documents, images, videos, datasets
- **Data Exports**: Reports, backups, bulk data downloads
- **Batch Operations**: Processing thousands of records
- **Streaming Data**: Real-time data feeds, live updates
- **Synchronization**: Syncing large datasets between systems

Without progress tracking, users experience:
- **Uncertainty**: Is the operation working or stuck?
- **Frustration**: How much longer will this take?
- **Abandonment**: Users may cancel operations that are actually progressing
- **Poor UX**: No feedback creates anxiety and confusion

### How Deepkit RPC Progress Tracking Works

Deepkit RPC implements automatic progress tracking through several mechanisms:

1. **Automatic Chunking**: Large messages are automatically split into chunks
2. **Progress Events**: Each chunk transfer generates progress events
3. **Bidirectional Tracking**: Both upload and download progress are tracked
4. **Type-Agnostic**: Works with any data type (objects, arrays, binary data)
5. **Memory Efficient**: Streaming prevents memory overflow
6. **Error Resilient**: Progress continues even if individual chunks fail

### The Chunking System

```
Large Data (1MB)
┌─────────────────────────────────────────────────────┐
│                    Original Data                    │
└─────────────────────────────────────────────────────┘
                         │
                    Automatic Chunking
                         │
                         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Chunk 1  │ │ Chunk 2  │ │ Chunk 3  │ │ Chunk 4  │
│  (64KB)  │ │  (64KB)  │ │  (64KB)  │ │  (64KB)  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
     │            │            │            │
     ▼            ▼            ▼            ▼
  Progress     Progress     Progress     Progress
   Event        Event        Event        Event
```

### Progress Information Structure

Progress events provide comprehensive information:

```typescript
interface ProgressInfo {
    current: number;    // Bytes transferred so far
    total: number;      // Total bytes to transfer
    progress: number;   // Completion ratio (0.0 to 1.0)
    speed?: number;     // Transfer speed in bytes/second
    eta?: number;       // Estimated time remaining in seconds
    chunkIndex?: number; // Current chunk being processed
    totalChunks?: number; // Total number of chunks
}
```

### Automatic vs Manual Progress

Deepkit RPC provides two types of progress tracking:

#### Automatic Progress (Recommended)
- **Zero Configuration**: Works automatically for large data transfers
- **Transparent**: No changes needed to existing RPC actions
- **Efficient**: Optimized chunk sizes and transfer patterns
- **Reliable**: Built-in error handling and retry logic

#### Manual Progress (Advanced)
- **Custom Control**: Define your own progress reporting logic
- **Business Logic**: Report progress based on business operations, not just data transfer
- **Complex Operations**: Multi-stage operations with custom progress calculation

## Basic Usage

```typescript
import { ClientProgress } from '@deepkit/rpc';

// Track download progress
const progress = ClientProgress.track();
progress.download.subscribe(info => {
    console.log(`Download: ${info.current}/${info.total} bytes (${Math.round(info.progress * 100)}%)`);
});

const controller = client.controller<FileController>('/files');
const fileData = await controller.downloadFile('large-file.zip');

// Track upload progress
const uploadProgress = ClientProgress.track();
uploadProgress.upload.subscribe(info => {
    console.log(`Upload: ${info.current}/${info.total} bytes (${Math.round(info.progress * 100)}%)`);
});

const fileBuffer = new Uint8Array(1024 * 1024); // 1MB file
await controller.uploadFile(fileBuffer);
```

## Server Implementation

No special implementation is required on the server side. Progress tracking works automatically with any RPC action that transfers large data:

```typescript
@rpc.controller('/files')
class FileController {
    @rpc.action()
    downloadFile(filename: string): Uint8Array {
        // Return large file data
        return fs.readFileSync(filename);
    }

    @rpc.action()
    uploadFile(data: Uint8Array): boolean {
        // Process uploaded file
        fs.writeFileSync('uploaded-file', data);
        return true;
    }

    @rpc.action()
    processLargeData(data: { items: any[] }): { processed: number } {
        // Even complex objects with large data trigger progress tracking
        return { processed: data.items.length };
    }
}
```

## Progress Information

The progress object provides detailed information about the transfer:

```typescript
interface ProgressInfo {
    current: number;  // Current bytes transferred
    total: number;    // Total bytes to transfer
    progress: number; // Progress as decimal (0.0 to 1.0)
}
```

## Multiple Concurrent Transfers

Each `ClientProgress.track()` call creates an independent progress tracker:

```typescript
// Track multiple downloads simultaneously
const download1Progress = ClientProgress.track();
const download2Progress = ClientProgress.track();

download1Progress.download.subscribe(info => {
    console.log(`File 1: ${Math.round(info.progress * 100)}%`);
});

download2Progress.download.subscribe(info => {
    console.log(`File 2: ${Math.round(info.progress * 100)}%`);
});

// Start downloads concurrently
const [file1, file2] = await Promise.all([
    controller.downloadFile('file1.zip'),
    controller.downloadFile('file2.zip')
]);
```

## Progress with Streaming

Progress tracking also works with streaming data:

```typescript
@rpc.controller('/stream')
class StreamController {
    @rpc.action()
    streamLargeDataset(): Observable<DataChunk> {
        return new Observable(observer => {
            // Stream large dataset
            for (let i = 0; i < 1000; i++) {
                observer.next({
                    id: i,
                    data: new Uint8Array(1024) // 1KB per chunk
                });
            }
            observer.complete();
        });
    }
}

// Client with progress tracking
const progress = ClientProgress.track();
progress.download.subscribe(info => {
    console.log(`Streaming progress: ${Math.round(info.progress * 100)}%`);
});

const stream = await controller.streamLargeDataset();
stream.subscribe(chunk => {
    console.log('Received chunk:', chunk.id);
});
```

## Custom Progress UI

You can easily integrate progress tracking with UI components:

```typescript
class FileUploadComponent {
    async uploadFile(file: File) {
        const progress = ClientProgress.track();
        
        // Update progress bar
        progress.upload.subscribe(info => {
            this.updateProgressBar(info.progress);
            this.updateStatusText(`${info.current}/${info.total} bytes`);
        });

        try {
            const fileData = new Uint8Array(await file.arrayBuffer());
            const result = await this.controller.uploadFile(fileData);
            this.showSuccess('File uploaded successfully');
        } catch (error) {
            this.showError('Upload failed: ' + error.message);
        }
    }

    private updateProgressBar(progress: number) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress * 100}%`;
        }
    }

    private updateStatusText(text: string) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = text;
        }
    }
}
```

## Automatic Chunking

Deepkit RPC automatically chunks large messages. The chunking behavior can be configured:

```typescript
// When creating the client, you can configure chunk size
const client = new RpcWebSocketClient('ws://localhost:8080', {
    // Chunk size in bytes (default: 64KB)
    chunkSize: 64 * 1024
});
```

## Progress with Complex Objects

Progress tracking works with any serializable data, including complex nested objects:

```typescript
interface LargeDataset {
    metadata: {
        name: string;
        version: string;
    };
    records: Array<{
        id: number;
        data: Uint8Array;
        properties: Record<string, any>;
    }>;
}

@rpc.controller('/data')
class DataController {
    @rpc.action()
    processDataset(dataset: LargeDataset): { processed: number } {
        // Process the large dataset
        return { processed: dataset.records.length };
    }

    @rpc.action()
    exportDataset(): LargeDataset {
        // Return large dataset
        return {
            metadata: { name: 'Export', version: '1.0' },
            records: Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                data: new Uint8Array(1024),
                properties: { index: i, timestamp: new Date() }
            }))
        };
    }
}
```

## Error Handling with Progress

Progress tracking continues to work even when errors occur:

```typescript
const progress = ClientProgress.track();
let totalBytesTransferred = 0;

progress.upload.subscribe(info => {
    totalBytesTransferred = info.current;
    console.log(`Transferred: ${info.current} bytes`);
});

try {
    await controller.uploadFile(largeFile);
} catch (error) {
    console.log(`Transfer failed after ${totalBytesTransferred} bytes`);
    console.error('Error:', error.message);
}
```

## Performance Considerations

- Progress tracking has minimal overhead for small messages
- Large files are automatically streamed in chunks to avoid memory issues
- Progress events are throttled to avoid overwhelming the UI
- Cleanup is automatic when transfers complete or fail

## Browser Compatibility

Progress tracking works in all modern browsers and Node.js environments. The underlying chunking mechanism uses efficient binary protocols for optimal performance.
