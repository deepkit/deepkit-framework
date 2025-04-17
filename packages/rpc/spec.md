# Architecture


```
Client:
    SendMessage() (RouteClient)
    RpcClientTransporter
        RpcBinaryMessageReader
            remoteContext?

    selfContext: Context (RouteClient)
    RpcActionClient (RouteClient)

    remote: RpcKernel (RouteServer)
        Connection
            SendMessage() (RouteServer)
            MessageReader

            remoteContext: Context
            RpcActionServer

    peers: RpcKernel[] (direct route)

Server:
    RpcKernel
        Connection
            SendMessage() (RouteServer)
            MessageReader

            selfContext: Context (RouteServer)
            RpcActionClient (RouteServer)

            remoteContext: Context (RouteClient)    
            RpcActionServer (RouteClient)
```
