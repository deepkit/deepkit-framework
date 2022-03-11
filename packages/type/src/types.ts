import { AutoIncrement, PrimaryKey } from './reflection/type';
import { Positive } from './validator';

export type AutoId = number & PrimaryKey & AutoIncrement & Positive;
