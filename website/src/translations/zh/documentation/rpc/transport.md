# 传输协议

Deepkit RPC 支持多种传输协议。WebSocket 协议兼容性最好（因为浏览器支持），同时支持诸如流式传输等全部特性。TCP 通常更快，适合服务器（微服务）之间或非浏览器客户端的通信。但用于服务器到服务器的通信，WebSocket 也同样表现良好。

## HTTP

Deepkit 的 RPC HTTP 协议是一种在浏览器中特别容易调试的变体，因为每个函数调用都是一个 HTTP 请求，但它也有局限，例如不支持 RxJS 流式传输。

待办：尚未实现。

## WebSocket

@deepkit/rpc-tcp `RpcWebSocketServer`，以及浏览器 WebSocket 或 Node 的 `ws` 包。

## TCP

@deepkit/rpc-tcp 的 `RpcNetTcpServer` 和 `RpcNetTcpClientAdapter`