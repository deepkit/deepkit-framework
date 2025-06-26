import { ClassType } from '@deepkit/core';
import { TypeRegistry } from '@deepkit/type';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ComponentRegistry {
    inputRegistry = new TypeRegistry<ClassType>();
    cellRegistry = new TypeRegistry<ClassType>();
}
