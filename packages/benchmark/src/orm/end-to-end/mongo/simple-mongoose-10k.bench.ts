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

import 'reflect-metadata';
import { BenchSuite } from '../../../bench';
import mongoose from 'mongoose';
const { Schema } = mongoose;

const modelSchema = new Schema({
    ready: Boolean,
    tags: [String],
    priority: Number,
    id: Number,
    name: String,
});

const Model = mongoose.model('mongoose-Model', modelSchema);

export async function main() {
    const count = 10_000;
    const m = await mongoose.connect('mongodb://localhost/bench-small-mongoose');

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const bench = new BenchSuite('mongoose');
        await Model.deleteMany();

        const items: any[] = [];
        for (let i = 1; i <= count; i++) {
            items.push({
                id: i, name: 'Peter ' + i,
                ready: true, priority: true,
                tags: ['a', 'b', 'c']
            })
        }

        await bench.runAsyncFix(1, 'insert', async () => {
            await Model.insertMany(items);
        });

        await Model.deleteMany();
        await bench.runAsyncFix(1, 'insert (lean)', async () => {
            await Model.insertMany(items, {lean: true});
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await Model.find();
        });

        await bench.runAsyncFix(10, 'fetch (lean)', async () => {
            await Model.find({}, {}, {lean: true});
        });

        await bench.runAsyncFix(1, 'update-query', async () => {
            await Model.updateMany({}, {$inc: {priority: 1}}, {multi: true});
        });

        await bench.runAsyncFix(1, 'update-query (lean)', async () => {
            await Model.updateMany({}, {$inc: {priority: 1}}, {multi: true, lean: true});
        });

        await bench.runAsyncFix(1, 'remove-query', async () => {
            await Model.deleteMany();
        });

        await bench.runAsyncFix(1, 'remove-query (lean)', async () => {
            await Model.deleteMany({}, {lean: true});
        });
    }

    m.disconnect();
}
