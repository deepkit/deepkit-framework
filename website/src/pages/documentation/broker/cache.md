# Broker Cache

Deepkit Broker Cache class is a multi-level (2 levels) cache that keeps a volatile local cache in memory and only fetches data from the broker server
if the data is not in the cache, stale, or was invalidated. This allows to use cache for very high performance and low latency data fetching.

The cache is designed to be type-safe and automatically serializes and deserializes data (using BSON). It also supports cache invalidation and cache clearing.
The implementation makes sure that per process the cache is rebuilt only once, even if multiple requests are trying to access the same cache item at the same time.

The data is not persisted on the server, but only kept in memory. If the server restarts, all data is lost.

## Usage

Make sure to read the Getting started page to learn how to properly set up your application so BrokerCache is available in the dependency injection container.

The cache abstraction in Deepkit Broker is very different to a simple key/value store. It works by defining a cache name and a builder function that is called automatically when the cache is empty or stale. This builder function is responsible to build the data that is then stored in the cache.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';

const cache = new BrokerCache(adapter);

const cacheItem = cache.item('my-cache', async () => {
  // this is the builder function that is called when 
  // the cache is empty or stale
  return 'hello world';
});


// check if cache is stale or empty
await cacheItem.exists();

// get the data from the cache or fetch it from the broker server
// if the cache is empty or stale, the builder function is called
// and result returned and send to the broker server.
const topUsers = await cacheItem.get();

// invalidate the cache so next get() call will 
// call the builder function again.
// Clears the local cache and server cache.
await cacheItem.invalidate();

// manually set data in the cache
await cacheItem.set(xy);
```

## App Usage

A full example of how to use the BrokerCache in your application.
The class is automatically available in the dependency injection container if you import the `FrameworkModule`.
See the Getting started page for more information.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// it's a good to have these types defined in a common file so you can reuse them
// and inject them into your services
type MyCacheItem = BrokerCacheItem<User[]>;

function createMyCache(cache: BrokerCache, database: Database) {
  return cache.item<User[]>('top-users', async () => {
    // this is the builder function that is called when 
    // the cache is empty or stale
    return await database.query(User)
      .limit(10).orderBy('score').find();
  });
}

class Service {
  constructor(private cacheItem: MyCacheItem) {
  }

  async getTopUsers() {
    return await this.cacheItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    Database,
    provide<MyCacheItem>(createMyCache),
  ],
  imports: [
    new FrameworkModule(),
  ],
});

const cacheItem = app.get<MyCacheItem>();

// get the data from the cache or fetch it from the broker server
const topUsers = await cacheItem.get();
```
