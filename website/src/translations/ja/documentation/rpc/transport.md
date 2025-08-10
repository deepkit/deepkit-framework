# トランスポートプロトコル

Deepkit RPC は複数のトランスポートプロトコルをサポートします。WebSocket は（ブラウザがサポートしているため）最も互換性が高く、ストリーミングなどのすべての機能もサポートするプロトコルです。TCP は通常、高速で、サーバー間（マイクロサービス）や非ブラウザクライアントとの通信に最適です。ただし、WebSocket もサーバー間通信でうまく機能します。

## HTTP

Deepkit の RPC HTTP プロトコルは、各関数呼び出しが HTTP リクエストであるため、ブラウザでのデバッグが特に容易なバリアントですが、RxJS ストリーミングをサポートしないなどの制限があります。

TODO: まだ実装されていません。

## WebSocket

@deepkit/rpc-tcp `RpcWebSocketServer` と ブラウザの WebSocket または Node の `ws` パッケージ。

## TCP

@deepkit/rpc-tcp `RpcNetTcpServer` と `RpcNetTcpClientAdapter`