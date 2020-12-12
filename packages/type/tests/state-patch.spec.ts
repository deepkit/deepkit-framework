import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {applyAndReturnPatches, applyPatch} from '../index';

class Goal {
    title: string = '';
}

class PersistentState {
    id: number = 0;
    goal: Goal = new Goal;
    goals: { [id: string]: Goal } = {};

    titles: string[] = [];

    addGoal(id: string, goal: Goal) {
        this.goals[id] = goal;
    }

    getTest(id: string) {
        return id;
    }
}

class State {
    title: string = '';
    persistent: PersistentState = new PersistentState;
    persistent2: PersistentState = new PersistentState;
    goals: Goal[] = [];
}

class StateWithMap {
    map: Map<any, any> = new Map();
}

test('check basics', () => {
    const state = new State();
    state.goals.push(new Goal());

    {
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.id = 12;
            expect(state.persistent.id).toBe(12);
            expect(state.persistent.getTest('123')).toBe('123');
        });
        newState.persistent.id = 12;
    }
});

test('check object map', () => {
    const state = new State();
    state.goals.push(new Goal());
    state.persistent.goals['foo'] = new Goal();

    {
        const newGoal = new Goal();
        expect(Object.keys(state.persistent.goals)).toEqual(['foo']);
        const newState = applyPatch(Object.freeze(state), (state) => {
            expect('foo' in state.persistent.goals).toBe(true);
            expect(Object.keys(state.persistent.goals)).toEqual(['foo']);
            state.persistent.addGoal('bar', newGoal);
            expect('bar' in state.persistent.goals).toBe(true);
            expect(Object.keys(state.persistent.goals)).toEqual(['foo', 'bar']);
            expect(state.persistent.goals['bar'] === newGoal).toBe(true);
        });
        expect('bar' in newState.persistent.goals).toBe(true);
        expect(Object.keys(newState.persistent.goals)).toEqual(['foo', 'bar']);
        expect(newState.persistent.goals['bar'] === newGoal).toBe(true);
    }
});

test('check unsupported', () => {
    const state = new StateWithMap();

    expect(() => {
        const newState = applyPatch(Object.freeze(state), (state) => {
            expect(state.map.get('asd')).toBe(undefined);
        });
    }).toThrow('Map and Set not supported');
});

test('check deep patch', () => {
    const state = new State();
    state.title = 'myState';
    state.goals.push(new Goal());
    state.persistent.titles.push('Init');

    expect(state.goals.length).toBe(1);

    {
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.id = 12;
            expect(state.persistent.id).toBe(12);
        });

        expect(state !== newState).toBe(true);
        expect(state.persistent.id).not.toBe(newState.persistent.id);
        expect(state.persistent !== newState.persistent).toBe(true);
        expect(state.persistent.goal === newState.persistent.goal).toBe(true);
        expect(state.goals === newState.goals).toBe(true);
    }

    {
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.id = 10;
            expect(state.title).toBe('myState');
            state.persistent2.id = 13;
            state.persistent.id = 12;
            expect(state.persistent.id).toBe(12);
            expect(state.persistent2.id).toBe(13);
        });

        expect(state !== newState).toBe(true);
        expect(newState.title).toBe('myState');
        expect(newState.persistent.id).toBe(12);
        expect(newState.persistent2.id).toBe(13);
        expect(state.persistent.id).not.toBe(newState.persistent.id);
        expect(state.persistent !== newState.persistent).toBe(true);
        expect(state.persistent.goal === newState.persistent.goal).toBe(true);
        expect(state.goals === newState.goals).toBe(true);
    }

    {
        expect(state.persistent.titles.length).toBe(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            expect(state.persistent.titles[0]).toBe('Init');
            state.persistent.titles.push('modified');
            expect(state.persistent.titles.length).toBe(2);
            expect(state.persistent.titles[1]).toBe('modified');
            const mod = state.persistent.titles.pop();
            expect(mod).toBe('modified');
            expect(state.persistent.titles.length).toBe(1);
            state.persistent.titles.unshift('newFirst');
            expect(state.persistent.titles.length).toBe(2);
            expect(state.persistent.titles[0]).toBe('newFirst');
            expect(state.persistent.titles[1]).toBe('Init');
            expect(state.persistent.titles.includes('Init')).toBe(true);
        });
        expect(newState.persistent.titles.length).toBe(2);
        expect(newState.persistent.titles[0]).toBe('newFirst');
        expect(newState.persistent.titles[1]).toBe('Init');
        expect(state.persistent.titles.includes('Init')).toBe(true);
        expect(newState.persistent.titles.includes('Init')).toBe(true);
        expect(newState.persistent.titles.includes('newFirst')).toBe(true);
        expect(state.persistent.titles.length).toBe(1);
        expect(state.persistent !== newState.persistent).toBe(true);
        expect(state.persistent.goal === newState.persistent.goal).toBe(true);
        expect(state.goals === newState.goals).toBe(true);
    }

    {
        //same ref check
        expect(state.persistent.titles.length).toBe(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.titles = state.persistent.titles;
            state.persistent.titles.unshift('newFirst');
            expect(state.persistent.titles.length).toBe(2);
            expect(state.persistent.titles[0]).toBe('newFirst');
            expect(state.persistent.titles[1]).toBe('Init');
        });
        expect(newState.persistent.titles.length).toBe(2);
        expect(newState.persistent.titles[0]).toBe('newFirst');
        expect(newState.persistent.titles[1]).toBe('Init');
        expect(state.persistent.titles.length).toBe(1);
    }

    {
        //same ref check doesnt change anything
        expect(state.persistent.titles.length).toBe(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.titles = state.persistent.titles;
        });
        expect(newState.persistent.titles.length).toBe(1);
        expect(state.persistent.titles.length).toBe(1);
        expect(state.persistent === newState.persistent).toBe(true);
    }
});


test('patches', () => {
    const state = new State();
    state.goals.push(new Goal());
    state.persistent.titles.push('Init');

    expect(state.goals.length).toBe(1);

    {
        const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
            state.persistent.id = 12;
        });
        expect(patches).toEqual({'persistent.id': 12});
    }

    // {
    //     const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
    //         state.persistent.id = 0;
    //     });
    //     expect(patches).toEqual({});
    // }

    {
        const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
            state.persistent.id = 12;
            state.persistent.titles = ['foo'];
        });
        expect(patches).toEqual({'persistent.id': 12, 'persistent.titles': ['foo']});
    }

    {
        const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
            state.persistent.titles.push('foo');
        });
        expect(patches).toEqual({'persistent.titles': ['Init', 'foo']});
    }

    {
        const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
            state.persistent.goal.title = 'deep';
        });
        expect(patches).toEqual({'persistent.goal.title': 'deep'});
    }

    {
        const patches = applyAndReturnPatches(Object.freeze(state), (state) => {
            state.persistent.goal = new Goal();
        });
        expect(patches).toEqual({'persistent.goal': new Goal()});
    }
});
