import {resolveSrv, resolveTxt} from 'dns';
import {asyncOperation} from '@deepkit/core';

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
                return {hostname: v.name, port: v.port};
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

                resolve({options, hosts});
            });
        });
    });
}