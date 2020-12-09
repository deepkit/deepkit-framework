/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {createWorkflow, WorkflowEvent} from '../workflow';
import {InjectorContext} from '../injector/injector';

export const rpcWorkflow = createWorkflow('rpc', {
    start: WorkflowEvent,
    connect: WorkflowEvent,
    authentication: WorkflowEvent,
    authorization: WorkflowEvent,
    accessDenied: WorkflowEvent,
    peerRegistration: WorkflowEvent,
    action: WorkflowEvent,
    actionCall: WorkflowEvent,
    actionException: WorkflowEvent,
    actionResult: WorkflowEvent,
    // disconnect: WorkflowEvent
}, {
    start: 'connect',
    connect: ['authentication', 'action', 'peerRegistration'],
    action: 'authorization',
    authorization: ['actionCall', 'accessDenied'],
    actionCall: ['actionException', 'actionResult'],
    // actionException: ['disconnect'],
    // actionResult: ['disconnect'],
    // accessDenied: ['disconnect']
});

export class RpcInjectorContext extends InjectorContext {}
