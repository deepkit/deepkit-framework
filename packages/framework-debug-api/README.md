# Framework Debugger API

This is the API package of the Deepkit Framework Debugger.

## Storage Architecture

The debugger storage works together with @deepkit/stopwatch. 
Stopwatcher is a library that exposes the classes, functions, and decorators to work indirectly
with the debugger storage. It collects all data points and puts them into a queue. 
The debugger (if enabled) then reads this queue and puts it on disk and streams changes to a broker,
so GUI clients can display the data in real-time.

Example:
```typescript

const stopwatch = new Stopwatch;

const frame = stopwatch.start('my/frame');

frame.data({arbitrary: 'data'});

frame.end();
```

When start is called a frame is created with the current timestamp using `performance.now` and
a unique id. Once stop is called the frame is ended and can not be used anymore. With data(T) the
user can provide additional data as arbitrary object.

### Frames and Data

There are two different fundamental data types: Frames and Frame Data.

Frames is a union of 3 types: FrameStart, FrameData, and FrameEnd. Each frame has a unique
id which is shared among those 3 types. Each has also a timestamp and other metadata. 
Using the id and timestamp all frames can be displayed on a flamegraph.

Frame Data is additional data that is not directly displayed in the flamegraph, however can
be displayed when a frame is clicked/hovered. This data is stored in a separate file.

Frame itself is binary and stored in one big file called FrameLog. The data might be spread across different files
to not get too big file sizes. All processes write to the same file, always appending the data.

A FrameStart package is a custom binary structure: <id uint32><worker uint8><type uint8><timestamp uint64><context uint32><category uint8><labelSize uint8><label utf8string>.
Each FrameStart package has a total byte size of min (32 +8 + 8 + 64 + 32 + 8 + 8)/8 = 20 bytes.

A FrameEnd package is a custom binary structure: <id uint32><worker uint8><type uint8><timestamp uint64>.
Each FrameEnd package has a total byte size of min (32 + 8 + 8 + 64)/8 = 14 bytes.

Sample calculation to get a feeling of how big a FrameLog can become:
A program executes 20 methods which are profiled, 5 events, 1 request, 5 workflow events, making total of 31 frames, average label size of 8 characters
=> (31)*(20+8)B = 868 bytes for FrameStart
=> (31)*(14)B = 434 bytes for FrameEnd
==> total of 1302 bytes for all frames per program profiling.
Logging 768 such program executions costs 1 megabytes.

Frame Data format is a custom binary structure: Each Frame Data entry has a little header, and a BSON body:
<id uint32><worker uint8><bson document>
Since <bson document> has a size prefix, the whole file is seekable.

Frame Data has also a header file along with it, allowing it to seek fast to certain positions. The header file is a custom binary structure as well:
<id uint32><worker uint8><seek uint32>
`seek` defines at which position in the Frame Data file the actual data is stored. This make it possible to fopen/fseek to the data fast enough.
Note: There can be multiple entries for the same id:worker combination, since Stopwatch supports updating Frame Data.

The GUI reads the FrameLog as a stream in real-time. Frame Data file is read on-demand when a certain window of the flamegraph is selected.
This is because the Frame Data file can potentially become very big since there are all other (possibly verbose) data stored.

Limitations: Since all data is stored in an append-only fashion, writing and reading is very fast. However, modifying or deleting
Frames or Frames Data are relatively expensive, but there's no use-case yet to modify or delete them. When this will be allowed,
it means that the Frame Data header file needs to be rewritten entirely, which might cost some time (but doesn't matter that much as it's not time sensitive).

### Model

```typescript
enum FrameCategory {
    http, rpc, cli, job, function, lock, workflow, event, database, email, template
}

interface FrameStart {
    id: number;
    worker: number;
    label: string;
    timestamp: number;
    context: number;
    category: FrameCategory;
}
interface FrameEnd {
    id: number;
    worker: number;
    timestamp: number;
}
```

### Use-Cases

1. DB query: We want to log which query took how long. We store at the FrameStart label "EntityName: Type" (Type=Update|Insert|Delete). 
   The full query including parameters are stored in Frame Data.
