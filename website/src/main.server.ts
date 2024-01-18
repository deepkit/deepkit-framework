import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { DirectClient, RpcKernel, RpcWebSocketClient } from "@deepkit/rpc";
import { mergeApplicationConfig } from "@angular/core";

export { platformServer, INITIAL_CONFIG } from "@angular/platform-server";
export { CommonEngine } from '@angular/ssr';
export { Router } from '@angular/router';

export const bootstrap = (rpcKernel: RpcKernel) => bootstrapApplication(AppComponent, mergeApplicationConfig(config, {
    providers: [
        //to catch all Promises(ZoneJs), we have to create DirectClient in this bundle
        { provide: RpcWebSocketClient, useFactory: () => new DirectClient(rpcKernel) },
    ]
}));
