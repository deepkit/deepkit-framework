# Deepkit Website

You are looking to change documentation? Go to ./src/pages/documentation

### Dev

Requires node v20.

```sh
npm ci

# frontend watcher
npm run app:start

# server watcher
npm run server:watch 
```

## SSR build

```
npm run app:build
npm run ssr:build
npm run server
``


## Build Docker image


```
cd website/
docker build -t website2 -f Dockerfile ../
docker run -p 8080:8080 -e app_databaseHost=host.docker.internal website2
```
