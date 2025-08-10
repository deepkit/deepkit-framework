# 전송 프로토콜

Deepkit RPC는 여러 전송 프로토콜을 지원합니다. WebSockets는 브라우저가 지원하기 때문에 호환성이 가장 좋으며, 스트리밍과 같은 모든 기능을 지원합니다. TCP는 일반적으로 더 빠르며 서버 간(마이크로서비스) 또는 비브라우저 클라이언트 간 통신에 적합합니다. 하지만 WebSockets도 서버 간 통신에 잘 동작합니다.

## HTTP

Deepkit의 RPC HTTP 프로토콜은 각 함수 호출이 HTTP 요청이기 때문에 브라우저에서 디버깅하기 특히 쉽지만, RxJS 스트리밍을 지원하지 않는 등의 제약이 있습니다.

TODO: 아직 구현되지 않았습니다.

## WebSockets

@deepkit/rpc-tcp `RpcWebSocketServer` 및 브라우저 WebSocket 또는 Node `ws` 패키지.

## TCP

@deepkit/rpc-tcp `RpcNetTcpServer` 와 `RpcNetTcpClientAdapter`