# RPC Package Errors

## DK-R001: RPC Error (Base)

**Message:** Custom message provided when error is thrown

**Causes:**
- This is the base error class for all RPC-related errors
- Thrown when an RPC operation fails for various reasons
- Used to wrap and propagate errors across the RPC boundary

**Solution:**
Check the error message for specific details about what failed. Common scenarios include:
- Network connectivity issues
- Server-side exceptions
- Invalid RPC method calls
- Serialization/deserialization failures

---

## DK-R002: Offline Error

**Message:** Custom message indicating offline state

**Causes:**
- The RPC client is not connected to the server
- Network connection was lost during an operation
- The server is unreachable or has gone offline
- Connection timeout occurred

**Solution:**
- Check network connectivity
- Verify the server is running and accessible
- Implement reconnection logic in your client:

```typescript
const client = new RpcClient(transport);

client.connection.subscribe((connected) => {
    if (!connected) {
        // Handle disconnection, show UI indicator
        console.log('Connection lost, attempting to reconnect...');
    }
});

// The client will automatically attempt to reconnect
```

---

## DK-R003: Authentication Error

**Message:** Custom authentication failure message

**Causes:**
- Authentication credentials are invalid or expired
- The authentication token was rejected by the server
- Required authentication was not provided
- User session has expired

**Solution:**
- Verify authentication credentials are correct
- Refresh or renew authentication tokens
- Re-authenticate the client:

```typescript
const client = new RpcClient(transport);

// Set authentication token
client.token.set({ token: 'your-auth-token' });

// Or handle authentication errors
try {
    const result = await client.controller.someMethod();
} catch (error) {
    if (error instanceof AuthenticationError) {
        // Redirect to login or refresh token
        await refreshAuthentication();
        // Retry the operation
    }
}
```

---

## DK-R004: Unexpected Message Type

**Message:** Custom message describing the unexpected message

**Causes:**
- Received an RPC message with an unexpected type
- Protocol mismatch between client and server versions
- Corrupted message received over the transport
- Message routing error in peer-to-peer communication

**Solution:**
- Ensure client and server are using compatible versions of `@deepkit/rpc`
- Check for network issues that might corrupt messages
- Verify the RPC protocol is being used correctly
- If using custom transports, ensure messages are being properly serialized:

```typescript
// Ensure both client and server use the same RPC kernel configuration
const kernel = new RpcKernel();
kernel.registerController(MyController, 'myController');

// Client should match the expected controller interface
const controller = client.controller<MyControllerInterface>('myController');
```
