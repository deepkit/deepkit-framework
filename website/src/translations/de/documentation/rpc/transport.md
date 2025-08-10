# Transportprotokoll

Deepkit RPC unterstützt mehrere Transportprotokolle. WebSockets ist das Protokoll mit der besten Kompatibilität (da Browser es unterstützen), während es alle Features wie Streaming unterstützt. TCP ist in der Regel schneller und eignet sich hervorragend für die Kommunikation zwischen Servern (Microservices) oder Nicht-Browser-Clients. Aber WebSockets funktionieren auch für die Server-zu-Server-Kommunikation gut.

## HTTP

Deepkits RPC-HTTP-Protokoll ist eine Variante, die sich im Browser besonders leicht debuggen lässt, da jeder Funktionsaufruf eine HTTP-Anfrage ist, weist jedoch Einschränkungen auf, wie etwa keine Unterstützung für RxJS-Streaming.

TODO: Noch nicht implementiert.

## WebSockets

@deepkit/rpc-tcp `RpcWebSocketServer` und Browser WebSocket oder Node-`ws`-Package.

## TCP

@deepkit/rpc-tcp `RpcNetTcpServer` und `RpcNetTcpClientAdapter`