import { TypeRegistry } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InputRegistry {
    registry = new TypeRegistry<ClassType>();
}
