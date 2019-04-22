import 'jest';
import 'reflect-metadata';
import {size} from "@marcj/estdlib";
import {observeItem} from "../src/observer";
import {Job, JobTask, JobTaskStatus} from "./entities";
import {EntitySubject} from "../src/core";

test('watch', () => {
    const job = new Job('1231', '12344');

    const observer = observeItem(job);
    job.iterations = 24;
    job.tasks['newone'] = new JobTask('newone', 1);

    job.config.ignore.push('asd');
    job.config.ignore.push('12e1');
    job.ended = new Date;

    expect(observer.changed()).toBe(true);

    const patches = observer.getPatchesAndReset()!;

    expect(size(patches)).toBe(5);
    expect(patches['iterations']).toBe(24);
    expect(patches['ended']).toBe(job.ended);
    expect(patches['tasks.newone']).toBe(job.tasks['newone']);
    expect(patches['config.ignore.0']).toBe('asd');
    expect(patches['config.ignore.1']).toBe('12e1');

    job.tasks['newone'].status = JobTaskStatus.queued;
    const patches2 = observer.getPatchesAndReset()!;
    expect(size(patches2)).toBe(1);
    expect(patches2['tasks.newone.status']).toBe(JobTaskStatus.queued);
    expect(observer.getPatchesAndReset()).toBeUndefined();
});

test('watch EntitySubject', () => {
    const job = new EntitySubject(new Job('1231', '12344'));

    const observer = observeItem(job);
    job.value.iterations = 24;
    job.value.tasks['newone'] = new JobTask('newone', 1);

    job.value.config.ignore.push('asd');
    job.value.config.ignore.push('12e1');
    job.value.ended = new Date;

    expect(observer.changed()).toBe(true);

    const patches = observer.getPatchesAndReset()!;

    expect(size(patches)).toBe(5);
    expect(patches['iterations']).toBe(24);
    expect(patches['ended']).toBe(job.value.ended);
    expect(patches['tasks.newone']).toBe(job.value.tasks['newone']);
    expect(patches['config.ignore.0']).toBe('asd');
    expect(patches['config.ignore.1']).toBe('12e1');

    job.value.tasks['newone'].status = JobTaskStatus.queued;
    const patches2 = observer.getPatchesAndReset()!;
    expect(size(patches2)).toBe(1);
    expect(patches2['tasks.newone.status']).toBe(JobTaskStatus.queued);
    expect(observer.getPatchesAndReset()).toBeUndefined();
});
