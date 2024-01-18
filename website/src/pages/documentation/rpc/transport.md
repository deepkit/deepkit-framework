# Transport Protocol

Deepkit RPC supports several transport protocols. WebSockets is the protocol that has the best compatibility (since browsers support it) while supporting all features like streaming. TCP is usually faster and is great for communication between servers (microservices) or non-browser clients. But WebSockets work well for server to server communication as well.

## HTTP

Deepkit's RPC HTTP protocol is a variant that is particularly easy to debug in the browser, as each function call is an HTTP request, but has its limitations such as no support for RxJS streaming.

TODO: Not implemented yet.

## WebSockets

@deepkit/rpc-tcp `RpcWebSocketServer` and Browser WebSocket or Node `ws` package.

## TCP

@deepkit/rpc-tcp `RpcNetTcpServer` and `RpcNetTcpClientAdapter`
