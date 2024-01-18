import { rpc } from '@deepkit/rpc';
import { http, HttpBody } from '@deepkit/http';
import { BenchmarkControllerInterface, BenchmarkRun } from "@app/common/benchmark";
import { Database } from "@deepkit/orm";
import { AppConfig } from "@app/server/config";

@rpc.controller(BenchmarkControllerInterface)
export class BenchmarkController implements BenchmarkControllerInterface {
    constructor(protected db: Database) {
    }

    @rpc.action()
    async getLastBenchmarkRuns(): Promise<BenchmarkRun[]> {
        return await this.db.query(BenchmarkRun).sort({ id: 'desc' }).limit(30).find();
    }
}

export class BenchmarkHttpController {
    constructor(protected db: Database, protected benchmarkSecret: AppConfig['benchmarkSecret']) {
    }

    @http.POST('benchmark/add')
    async postBenchmark(body: HttpBody<{ auth: string, run: BenchmarkRun }>) {
        if (body.auth !== this.benchmarkSecret) {
            throw new Error('Invalid auth');
        }

        const dataSize = Object.keys(body.run.data).length;

        console.log('benchmark add', body.run);
        if (!dataSize) {
            throw new Error('Data empty');
        }

        await this.db.persist(body.run);

        console.log('benchmark added', body.run);
        return true;
    }
}
