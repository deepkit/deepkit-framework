import 'jest-extended';
import 'reflect-metadata';
import {size} from "@super-hornet/core";
import {observeItem} from "../src/observer";
import {Job, JobTask, JobTaskStatus} from "./entities";
import {EntitySubject} from "../src/core";

test('watch apply', () => {
    new Job('1231', '12344');

    const original = new Job('1231', '12344');
    const observer = observeItem(original);
    const job = observer.snapshot;
    job.iterations = 24;
    job.tasks['newone'] = new JobTask('newone', 1);

    const patches = observer.getPatches()!;
    expect(size(patches)).toBe(2);
    expect(patches['iterations']).toBe(24);
    expect(patches['tasks.newone']).toBeInstanceOf(JobTask);

    expect(original.iterations).toBe(0);
    expect(original.tasks['newone']).toBeUndefined();

    observer.applyAndReset();
    expect(observer.getPatches()).toBeUndefined();

    expect(original.iterations).toBe(24);
    expect(job.tasks['newone'] ).toBeInstanceOf(JobTask);
});

test('watch', () => {
    new Job('1231', '12344');

    const observer = observeItem(new Job('1231', '12344'));
    const job = observer.snapshot;
    job.iterations = 24;
    job.tasks['newone'] = new JobTask('newone', 1);

    job.config.ignore.push('asd');
    job.config.ignore.push('12e1');
    job.ended = new Date;

    expect(observer.changed()).toBe(true);

    const rawPatches = observer.getRawPatches()!;
    expect(rawPatches['iterations']).toBe(24);
    expect(rawPatches['ended']).toBe(job.ended.toJSON());
    expect(rawPatches['tasks.newone']).not.toBeInstanceOf(JobTask);

    const patches = observer.getPatchesAndReset()!;
    expect(size(patches)).toBe(5);
    expect(patches['iterations']).toBe(24);
    expect(patches['ended']).toBe(job.ended);
    expect(patches['tasks.newone']).toBeInstanceOf(JobTask);
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
    const observer = observeItem(new EntitySubject(new Job('1231', '12344')));
    const job = observer.snapshot;
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
