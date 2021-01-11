import { InjectionToken } from '@angular/core';
import type { HttpRequest, HttpResponse } from '@deepkit/framework';

export const REQUEST = new InjectionToken<HttpRequest>('REQUEST');
export const RESPONSE = new InjectionToken<HttpResponse>('RESPONSE');
