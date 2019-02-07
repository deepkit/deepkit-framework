import 'jest-extended';
import 'reflect-metadata';
import {
  classToPlain,
  getCachedParameterNames,
  getRegisteredProperties,
  plainToClass,
} from '../src/mapper';
import { Job } from './big-entity';
import { SimpleModel, SuperSimple } from './entities';

function benchTime(title: string): () => void {
  const started = performance.now();
  return () => {
    console.log(title, performance.now() - started, 'ms');
  };
}

function bench(title: string, exec: () => void) {
  const b = benchTime(title);
  exec();
  b();
}

test('speed ', () => {
  //warm up
  const mainInstance = plainToClass(Job, {
    id: '1',
    project: '2',
    title: 'Foo',
    config: {
      parameters: {
        lr: 0.05,
        optimizer: 'sgd',
      },
    },
    tasks: {
      meiner: {
        commands: [{ name: 'erster', command: 'ls -al' }],
      },
    },
    created: '2018-11-25 23:38:24.339Z',
    updated: '2018-11-25 23:38:24.339Z',
    status: 50,
  });
  plainToClass(Job, {});

  // bench('single create', () => {
  //     const job = new Job('21313', '2');
  //     job.title = 'Foo';
  // });
  //
  // bench('single create2', () => {
  //     const job = new Job('21313', '2');
  //     job.title = 'Foo';
  // });
  //
  // bench('single plainToClass', () => {
  //     const instance = plainToClass(Job, {
  //         id: '21313',
  //         project: '2',
  //         title: 'Foo',
  //     });
  // });
  //
  // bench('single plainToClass 2', () => {
  //     const instance = plainToClass(Job, {
  //         id: '21313',
  //         project: '2',
  //         title: 'Foo',
  //     });
  // });
  //
  // bench('100x plainToClass', () => {
  //     for (let i = 0; i < 100; i++) {
  //         const instance = plainToClass(Job, {
  //             id: i,
  //             project: '2',
  //             title: 'Foo',
  //         });
  //     }
  // });
  //
  // bench('100x plainToClass', () => {
  //     for (let i = 0; i < 100; i++) {
  //         const instance = plainToClass(Job, {
  //             id: i,
  //             project: '2',
  //             title: 'Foo',
  //         });
  //     }
  // });

  // bench('10000x getRegisteredProperties', () => {
  //     for (let i = 0; i < 10000; i++) {
  //         getRegisteredProperties(Job);
  //     }
  // });
  //
  // bench('10000x getRegisteredProperties', () => {
  //     for (let i = 0; i < 10000; i++) {
  //         const parentReferences = {};
  //         const propertyNames = getRegisteredProperties(Job);
  //         for (const propertyName of propertyNames) {
  //             parentReferences[propertyName] = true;
  //         }
  //     }
  // });

  // bench('10000x getCachedParameterNames', () => {
  //     for (let i = 0; i < 10000; i++) {
  //         getCachedParameterNames(Job);
  //     }
  // });
  bench('10000x plainToClass big', () => {
    for (let i = 0; i < 10000; i++) {
      plainToClass(Job, {
        id: i,
        project: '2',
        title: 'Foo',
        config: {
          parameters: {
            lr: 0.05,
            optimizer: 'sgd',
          },
        },
        tasks: {
          meiner: {
            commands: [{ name: 'erster', command: 'ls -al' }],
          },
        },
        created: '2018-11-25 23:38:24.339Z',
        updated: '2018-11-25 23:38:24.339Z',
        status: 50,
      });
    }
  });

  bench('10000x classToPlain big', () => {
    for (let i = 0; i < 10000; i++) {
      classToPlain(Job, mainInstance);
    }
  });

  bench('10000x plainToClass SuperSimple', () => {
    for (let i = 0; i < 10000; i++) {
      plainToClass(SuperSimple, {
        name: i,
      });
    }
  });

  const base = plainToClass(SuperSimple, {
    name: '1',
  });

  bench('10000x classToPlain SuperSimple', () => {
    for (let i = 0; i < 10000; i++) {
      classToPlain(SuperSimple, base);
    }
  });

  console.log('done');
});
