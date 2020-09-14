# estdlib.ts RXJS

[![Build Status](https://travis-ci.com/marcj/estdlib.ts.svg?branch=master)](https://travis-ci.com/marcj/estdlib.ts)
[![npm version](https://badge.fury.io/js/%40marcj%2Festdlib.svg)](https://badge.fury.io/js/%40marcj%2Festdlib-rxjs)

### Installation

```
npm install @deepkit/core-rxjs
```


### Usage example

```typescript
import {Subscriptions} from "@deepkit/core-rxjs";

class MyComponent implements OnDestroy, OnInit {
    private subs = new Subscriptions;

    public onInit() {
        this.subs.add = this.observable.subscribe(() => {
            //do something
        });

        this.subs.add = this.anotherOne.subscribe(() => {
            //do something
        });
    }
    
    public OnDestroy() {
        this.subs.unsubscribe();
    }
}

```
