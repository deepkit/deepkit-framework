# Peer-to-Peer Communication

## Understanding RPC Peer-to-Peer Architecture

Peer-to-peer (P2P) communication in Deepkit RPC represents a paradigm shift from traditional client-server models to distributed architectures where clients can communicate directly with each other through the server acting as a broker. This enables powerful patterns for real-time collaboration, distributed computing, and decentralized applications while maintaining the security and control of a centralized broker.

### Traditional vs P2P Communication Models

#### Traditional Client-Server Model
```
Client A ──────→ Server ←────── Client B
         Request        Request

Client A ←────── Server ──────→ Client B
         Response       Response
```

**Limitations:**
- All communication must go through server business logic
- Server becomes a bottleneck for client-to-client interactions
- Difficult to implement real-time collaboration features
- Server must maintain state for all client interactions

#### P2P Broker Model
```
Client A ←──────→ Server ←──────→ Client B
         Register        Register

Client A ←─────────────────────→ Client B
         Direct P2P Communication
         (through server broker)
```

**Advantages:**
- Direct client-to-client communication
- Server acts as secure broker and coordinator
- Reduced server load for client interactions
- Natural fit for collaborative applications
- Scalable architecture for distributed systems

### How P2P Works in Deepkit RPC

Deepkit RPC's P2P system operates through a broker pattern:

1. **Client Registration**: Clients register themselves as peers with unique IDs
2. **Capability Advertisement**: Peers can advertise their available controllers/services
3. **Discovery**: Peers can discover other available peers and their capabilities
4. **Secure Communication**: All P2P communication is mediated by the server for security
5. **Type Safety**: Full TypeScript type safety is maintained across peer connections

### P2P Architecture Components

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│   Peer A    │    │   RPC Broker    │    │   Peer B    │
│             │    │    (Server)     │    │             │
│ Controllers │◄──►│  - Peer Registry │◄──►│ Controllers │
│ Services    │    │  - Security     │    │ Services    │
│ Capabilities│    │  - Routing      │    │ Capabilities│
└─────────────┘    │  - Discovery    │    └─────────────┘
                   └─────────────────┘
```

### Key P2P Concepts

#### Peer Identity
- **Unique Peer IDs**: Each peer has a unique identifier
- **Registration**: Peers must register with the broker before communication
- **Authentication**: Peer registration can be secured with authentication
- **Lifecycle Management**: Automatic cleanup when peers disconnect

#### Peer Controllers
- **Distributed Services**: Peers can expose RPC controllers to other peers
- **Service Discovery**: Peers can discover available services on other peers
- **Type Safety**: Full TypeScript interfaces for peer-to-peer calls
- **Error Handling**: Proper error propagation across peer connections

#### Security Model
- **Broker Mediation**: All communication goes through the secure broker
- **Access Control**: Fine-grained control over peer-to-peer permissions
- **Authentication**: Peer registration and communication can be authenticated
- **Audit Trail**: All peer interactions can be logged and monitored

### Use Cases for P2P Communication

#### Real-time Collaboration
- **Document Editing**: Multiple users editing the same document
- **Whiteboarding**: Shared drawing and annotation tools
- **Code Collaboration**: Real-time code editing and review
- **Design Tools**: Collaborative design and prototyping

#### Gaming and Entertainment
- **Multiplayer Games**: Real-time game state synchronization
- **Chat Systems**: Direct messaging between players
- **Matchmaking**: Peer discovery and game room creation
- **Streaming**: Peer-to-peer content streaming

#### Distributed Computing
- **Task Distribution**: Distributing work across multiple clients
- **Data Processing**: Collaborative data analysis and processing
- **Resource Sharing**: Sharing computational resources between peers
- **Load Balancing**: Distributing load across peer nodes

#### Communication Platforms
- **Video Conferencing**: Direct peer-to-peer video/audio streams
- **File Sharing**: Direct file transfers between users
- **Screen Sharing**: Remote desktop and screen sharing
- **Instant Messaging**: Real-time messaging with presence

## Basic Peer-to-Peer Setup

### Server Configuration

First, set up a server that acts as a broker for peer-to-peer communication:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

@rpc.controller('/broker')
class BrokerController {
    @rpc.action()
    ping(): string {
        return 'pong';
    }
}

const app = new App({
    controllers: [BrokerController],
    imports: [new FrameworkModule({
        rpc: {
            // Enable peer-to-peer features
            enablePeerToPeer: true
        }
    })]
});

app.run();
```

### Client Registration as Peer

Clients must register themselves as peers to participate in P2P communication:

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';

// Client 1 - Register as peer
const client1 = new RpcWebSocketClient('ws://localhost:8080');
await client1.connect();
await client1.registerAsPeer('client-1');

// Client 2 - Register as peer  
const client2 = new RpcWebSocketClient('ws://localhost:8080');
await client2.connect();
await client2.registerAsPeer('client-2');
```

## Peer Controllers

Peers can register controllers that other peers can call:

```typescript
@entity.name('chat-message')
class ChatMessage {
    constructor(
        public from: string,
        public message: string,
        public timestamp: Date = new Date()
    ) {}
}

@rpc.controller('/chat')
class ChatPeerController {
    private messages: ChatMessage[] = [];

    @rpc.action()
    sendMessage(message: ChatMessage): void {
        this.messages.push(message);
        console.log(`Received message from ${message.from}: ${message.message}`);
    }

    @rpc.action()
    getMessages(): ChatMessage[] {
        return this.messages;
    }

    @rpc.action()
    clearMessages(): void {
        this.messages = [];
    }
}

// Register the controller on both clients
client1.registerController('/chat', new ChatPeerController());
client2.registerController('/chat', new ChatPeerController());
```

## Peer-to-Peer Communication

Once peers are registered, they can communicate directly:

```typescript
// Client 1 sends message to Client 2
const client2ChatController = client1.peer('client-2').controller<ChatPeerController>('/chat');
await client2ChatController.sendMessage(new ChatMessage('client-1', 'Hello from client 1!'));

// Client 2 sends message to Client 1
const client1ChatController = client2.peer('client-1').controller<ChatPeerController>('/chat');
await client1ChatController.sendMessage(new ChatMessage('client-2', 'Hello back from client 2!'));

// Get messages from peer
const messages = await client1ChatController.getMessages();
console.log('Messages on client 1:', messages);
```

## Real-time Collaboration

Use peer-to-peer communication for real-time collaboration features:

```typescript
@entity.name('document-edit')
class DocumentEdit {
    constructor(
        public documentId: string,
        public userId: string,
        public operation: 'insert' | 'delete' | 'replace',
        public position: number,
        public content: string,
        public timestamp: Date = new Date()
    ) {}
}

@rpc.controller('/collaboration')
class CollaborationController {
    private document: string = '';
    private edits: DocumentEdit[] = [];
    private collaborators = new Set<string>();

    @rpc.action()
    joinDocument(documentId: string, userId: string): { document: string, edits: DocumentEdit[] } {
        this.collaborators.add(userId);
        return {
            document: this.document,
            edits: this.edits
        };
    }

    @rpc.action()
    applyEdit(edit: DocumentEdit): void {
        this.edits.push(edit);
        this.applyEditToDocument(edit);
        console.log(`Edit applied by ${edit.userId}: ${edit.operation} at ${edit.position}`);
    }

    @rpc.action()
    leaveDocument(userId: string): void {
        this.collaborators.delete(userId);
    }

    @rpc.action()
    getCollaborators(): string[] {
        return Array.from(this.collaborators);
    }

    private applyEditToDocument(edit: DocumentEdit): void {
        switch (edit.operation) {
            case 'insert':
                this.document = this.document.slice(0, edit.position) + 
                               edit.content + 
                               this.document.slice(edit.position);
                break;
            case 'delete':
                this.document = this.document.slice(0, edit.position) + 
                               this.document.slice(edit.position + edit.content.length);
                break;
            case 'replace':
                this.document = this.document.slice(0, edit.position) + 
                               edit.content + 
                               this.document.slice(edit.position + 1);
                break;
        }
    }
}
```

Usage in collaborative editing:

```typescript
// Multiple clients join the same document
const docId = 'shared-document-1';

// Client 1 joins
client1.registerController('/collaboration', new CollaborationController());
const client1Collab = client1.peer('client-1').controller<CollaborationController>('/collaboration');
await client1Collab.joinDocument(docId, 'user-1');

// Client 2 joins
client2.registerController('/collaboration', new CollaborationController());
const client2Collab = client2.peer('client-2').controller<CollaborationController>('/collaboration');
await client2Collab.joinDocument(docId, 'user-2');

// Client 1 makes an edit and notifies Client 2
const edit = new DocumentEdit(docId, 'user-1', 'insert', 0, 'Hello ');
await client1Collab.applyEdit(edit);

// Notify other collaborators
const client2CollabFromClient1 = client1.peer('client-2').controller<CollaborationController>('/collaboration');
await client2CollabFromClient1.applyEdit(edit);
```

## Peer Discovery

Discover available peers and their capabilities:

```typescript
@rpc.controller('/discovery')
class PeerDiscoveryController {
    private capabilities: string[] = [];

    @rpc.action()
    registerCapabilities(capabilities: string[]): void {
        this.capabilities = capabilities;
    }

    @rpc.action()
    getCapabilities(): string[] {
        return this.capabilities;
    }

    @rpc.action()
    ping(): { peerId: string, timestamp: Date } {
        return {
            peerId: 'current-peer',
            timestamp: new Date()
        };
    }
}

// Register capabilities
client1.registerController('/discovery', new PeerDiscoveryController());
const discovery1 = client1.peer('client-1').controller<PeerDiscoveryController>('/discovery');
await discovery1.registerCapabilities(['chat', 'file-sharing', 'video-call']);

client2.registerController('/discovery', new PeerDiscoveryController());
const discovery2 = client2.peer('client-2').controller<PeerDiscoveryController>('/discovery');
await discovery2.registerCapabilities(['chat', 'screen-sharing']);

// Discover peer capabilities
const client2Capabilities = await client1.peer('client-2').controller<PeerDiscoveryController>('/discovery').getCapabilities();
console.log('Client 2 capabilities:', client2Capabilities);
```

## File Sharing Between Peers

Implement file sharing using peer-to-peer communication:

```typescript
@entity.name('file-chunk')
class FileChunk {
    constructor(
        public fileId: string,
        public chunkIndex: number,
        public totalChunks: number,
        public data: Uint8Array,
        public checksum: string
    ) {}
}

@rpc.controller('/file-sharing')
class FileSharingController {
    private receivedChunks = new Map<string, Map<number, FileChunk>>();
    private sharedFiles = new Map<string, Uint8Array>();

    @rpc.action()
    shareFile(fileId: string, fileName: string, fileData: Uint8Array): void {
        this.sharedFiles.set(fileId, fileData);
        console.log(`File ${fileName} (${fileId}) is now available for sharing`);
    }

    @rpc.action()
    requestFile(fileId: string): Observable<FileChunk> {
        const fileData = this.sharedFiles.get(fileId);
        if (!fileData) {
            throw new Error(`File ${fileId} not found`);
        }

        return new Observable(observer => {
            const chunkSize = 64 * 1024; // 64KB chunks
            const totalChunks = Math.ceil(fileData.length / chunkSize);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, fileData.length);
                const chunkData = fileData.slice(start, end);
                
                const chunk = new FileChunk(
                    fileId,
                    i,
                    totalChunks,
                    chunkData,
                    this.calculateChecksum(chunkData)
                );

                setTimeout(() => observer.next(chunk), i * 10); // Throttle chunks
            }

            setTimeout(() => observer.complete(), totalChunks * 10);
        });
    }

    @rpc.action()
    receiveFileChunk(chunk: FileChunk): void {
        if (!this.receivedChunks.has(chunk.fileId)) {
            this.receivedChunks.set(chunk.fileId, new Map());
        }

        const fileChunks = this.receivedChunks.get(chunk.fileId)!;
        fileChunks.set(chunk.chunkIndex, chunk);

        console.log(`Received chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} for file ${chunk.fileId}`);

        // Check if file is complete
        if (fileChunks.size === chunk.totalChunks) {
            this.assembleFile(chunk.fileId);
        }
    }

    private assembleFile(fileId: string): void {
        const chunks = this.receivedChunks.get(fileId)!;
        const sortedChunks = Array.from(chunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
        
        const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
        const assembledFile = new Uint8Array(totalSize);
        
        let offset = 0;
        for (const chunk of sortedChunks) {
            assembledFile.set(chunk.data, offset);
            offset += chunk.data.length;
        }

        this.sharedFiles.set(fileId, assembledFile);
        console.log(`File ${fileId} assembled successfully (${totalSize} bytes)`);
    }

    private calculateChecksum(data: Uint8Array): string {
        // Simple checksum implementation
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum.toString(16);
    }
}
```

File sharing usage:

```typescript
// Client 1 shares a file
client1.registerController('/file-sharing', new FileSharingController());
const fileSharing1 = client1.peer('client-1').controller<FileSharingController>('/file-sharing');

const fileData = new Uint8Array(1024 * 1024); // 1MB file
await fileSharing1.shareFile('file-123', 'document.pdf', fileData);

// Client 2 requests the file
client2.registerController('/file-sharing', new FileSharingController());
const fileSharing2 = client2.peer('client-2').controller<FileSharingController>('/file-sharing');

const fileSharing1FromClient2 = client2.peer('client-1').controller<FileSharingController>('/file-sharing');
const fileStream = await fileSharing1FromClient2.requestFile('file-123');

fileStream.subscribe({
    next: (chunk) => {
        // Forward chunk to local file sharing controller
        fileSharing2.receiveFileChunk(chunk);
    },
    complete: () => {
        console.log('File transfer completed');
    },
    error: (error) => {
        console.error('File transfer error:', error);
    }
});
```

## Security Considerations

Implement security for peer-to-peer communication:

```typescript
import { RpcKernelSecurity, Session } from '@deepkit/rpc';

class P2PSecurity extends RpcKernelSecurity {
    async isAllowedToRegisterAsPeer(session: Session, peerId: string): Promise<boolean> {
        // Validate peer registration
        return session.isAuthenticated() && this.isValidPeerId(peerId);
    }

    async isAllowedToSendToPeer(session: Session, peerId: string): Promise<boolean> {
        // Control which peers can communicate
        return session.isAuthenticated() && this.canCommunicateWith(session, peerId);
    }

    private isValidPeerId(peerId: string): boolean {
        // Validate peer ID format
        return /^[a-zA-Z0-9-_]+$/.test(peerId) && peerId.length <= 50;
    }

    private canCommunicateWith(session: Session, peerId: string): boolean {
        // Implement your communication rules
        return true;
    }
}
```

## Performance Optimization

- Use efficient serialization for large data transfers
- Implement chunking for file transfers
- Consider compression for text-based communication
- Use connection pooling for multiple peer connections
- Implement proper cleanup when peers disconnect

## Error Handling

Handle peer communication errors gracefully:

```typescript
try {
    const peerController = client.peer('target-peer').controller<SomeController>('/controller');
    await peerController.someAction();
} catch (error) {
    if (error.message.includes('Peer controller not registered')) {
        console.log('Target peer is not available');
    } else if (error.message.includes('Peer not found')) {
        console.log('Target peer is not connected');
    } else {
        console.error('Communication error:', error);
    }
}
```
