# @deepkit/filesystem Errors

## DK-FS001: Filesystem Error

**Message:** Generic filesystem error (base class for all filesystem errors)

**Causes:**
- General filesystem operation failure
- Unable to write to a file that doesn't exist in the virtual filesystem

**Solution:**
Check the specific error message for details. This is the base error class, so the actual cause depends on the operation being performed. Ensure the file exists before attempting operations like write.

---

## DK-FS002: File Not Found

**Message:** `File not found`

**Causes:**
- Attempting to read or access a file that doesn't exist
- Using `Filesystem.get()` with a path that has no corresponding file
- The file was deleted or never created

**Solution:**
1. Verify the file path is correct
2. Use `Filesystem.exists()` to check if a file exists before accessing it
3. Handle the error gracefully in your code:

```typescript
const filesystem = new Filesystem(adapter);

// Option 1: Check existence first
if (await filesystem.exists('/path/to/file.txt')) {
    const file = await filesystem.get('/path/to/file.txt');
}

// Option 2: Handle the exception
try {
    const file = await filesystem.get('/path/to/file.txt');
} catch (error) {
    if (error instanceof FilesystemFileNotFound) {
        // Handle missing file
    }
}
```

---

## DK-FS003: Operation Aborted

**Message:** `Operation aborted`

**Causes:**
- A filesystem operation was manually aborted via the abort mechanism
- User cancelled an upload or download in progress
- Timeout or external cancellation of a long-running operation

**Solution:**
This error is expected when you intentionally abort an operation. If unexpected, check:

1. Whether `abort()` was called on the operation
2. If there's a timeout configured that's being exceeded
3. External factors that might trigger abort callbacks

```typescript
const operation = filesystem.write('/large-file.bin', data);

// Monitor progress
operation.onProgress((loaded, total) => {
    console.log(`${loaded}/${total} bytes`);
});

// Abort if needed
operation.abort();

// Handle abort in your code
try {
    await operation;
} catch (error) {
    if (error instanceof FilesystemOperationAborted) {
        console.log('Upload was cancelled');
    }
}
```

---
