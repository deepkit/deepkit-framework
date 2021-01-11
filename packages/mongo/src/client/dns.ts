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

import { resolveSrv, resolveTxt } from 'dns';
import { asyncOperation } from '@deepkit/core';

function matchesParentDomain(srvAddress, parentDomain) {
    const regex = /^.*?\./;
    const srv = `.${srvAddress.replace(regex, '')}`;
    const parent = `.${parentDomain.replace(regex, '')}`;
    return srv.endsWith(parent);
}

export async function resolveSrvHosts(hostname: string): Promise<{ options: string, hosts: { hostname: string, port: number }[] }> {
    return await asyncOperation(async (resolve, reject) => {
        resolveSrv(`_mongodb._tcp.${hostname}`, (err?, addresses?) => {
            if (err) return reject(err);

            for (const address of addresses) {
                if (!matchesParentDomain(hostname, address.name)) {
                    return reject(new Error(`SRV Hostname doesnt match ${hostname} vs ${address.name}`));
                }
            }
            const hosts = addresses.map(v => {
                return { hostname: v.name, port: v.port };
            });

            resolveTxt(hostname, (err, records) => {
                if (err) {
                    reject(err);
                    return;
                }

                let options = '';
                if (records.length) {
                    options = records[0].join('');
                }

                resolve({ options, hosts });
            });
        });
    });
}
