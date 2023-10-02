import { expect, test } from '@jest/globals';
import { TypeEnum } from '../src/lib/reflection/type.js';
import { ReflectionClass, ReflectionMethod, ReflectionFunction, typeOf } from '../src/lib/reflection/reflection.js';

test('description available on Interface and Type alias', () => {
  /** @description user interface */
  interface IUser {
    username: string;
  }

  /** @description user type declaration */
  type IUser2 = {
    username: string;
  }

  const reflectTypeInterface = ReflectionClass.from(typeOf<IUser>());
  expect(reflectTypeInterface.description).toEqual('user interface');
  expect(reflectTypeInterface.type.description).toEqual('user interface');

  const reflectTypeObjectLiteral = ReflectionClass.from(typeOf<IUser2>());
  expect(reflectTypeObjectLiteral.description).toEqual('user type declaration');
  expect(reflectTypeObjectLiteral.type.description).toEqual('user type declaration');
});

test('description available on ReflectionClass', () => {
  class MyDate {}

  /** @description user class */
  class User {
      myDate?: MyDate;
      created: Date = new Date;
  }
  const reflection = ReflectionClass.from(typeOf<User>());
  expect(reflection.description).toEqual('user class');
});

test('description available on ReflectionFunction and ReflectionMethod', () => {
  class MyDate {}
  /** @description user class */
  class User {
      myDate?: MyDate;
      created: Date = new Date;
  }
  /** @description getUser function */
  function getUser(): User {
    return new User()
  }

  class FunctionContainer {
    /** @description getUser member */
    getUser(): User {
      return new User()
    }
  }

  const reflectionFunction = ReflectionFunction.from(getUser);
  expect(reflectionFunction.getDescription()).toEqual('getUser function');

  const fc = new FunctionContainer();
  const reflection = ReflectionClass.from(typeOf<FunctionContainer>());
  const method:ReflectionMethod = reflection.getMethod('getUser')
  expect(method.description).toEqual('getUser member');
});

test('description available on TypeEnum', () => {
  /** @description results enum */
  enum RESULTS {
    SUCCESS = 'success',
    FAILURE = 'failure'
  }
  const type = typeOf<RESULTS>() as TypeEnum;
  expect(type.description).toEqual('results enum');

});


