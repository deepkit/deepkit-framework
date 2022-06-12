import { AutoIncrement, PrimaryKey } from './reflection/type.js';
import { Positive } from './validator.js';

export type AutoId = number & PrimaryKey & AutoIncrement & Positive;
