import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {applyPatch, applyAndReturnPatches} from "..";

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
            expect('foo' in state.persistent.goals).toBeTrue();
            expect(Object.keys(state.persistent.goals)).toEqual(['foo']);
            state.persistent.addGoal('bar', newGoal);
            expect('bar' in state.persistent.goals).toBeTrue();
            expect(Object.keys(state.persistent.goals)).toEqual(['foo', 'bar']);
            expect(state.persistent.goals['bar'] === newGoal).toBeTrue();
        });
        expect('bar' in newState.persistent.goals).toBeTrue();
        expect(Object.keys(newState.persistent.goals)).toEqual(['foo', 'bar']);
        expect(newState.persistent.goals['bar'] === newGoal).toBeTrue();
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

    expect(state.goals).toBeArrayOfSize(1);

    {
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.id = 12;
            expect(state.persistent.id).toBe(12);
        });

        expect(state !== newState).toBeTrue();
        expect(state.persistent.id).not.toBe(newState.persistent.id);
        expect(state.persistent !== newState.persistent).toBeTrue();
        expect(state.persistent.goal === newState.persistent.goal).toBeTrue();
        expect(state.goals === newState.goals).toBeTrue();
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

        expect(state !== newState).toBeTrue();
        expect(newState.title).toBe('myState');
        expect(newState.persistent.id).toBe(12);
        expect(newState.persistent2.id).toBe(13);
        expect(state.persistent.id).not.toBe(newState.persistent.id);
        expect(state.persistent !== newState.persistent).toBeTrue();
        expect(state.persistent.goal === newState.persistent.goal).toBeTrue();
        expect(state.goals === newState.goals).toBeTrue();
    }

    {
        expect(state.persistent.titles).toBeArrayOfSize(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            expect(state.persistent.titles[0]).toBe('Init');
            state.persistent.titles.push('modified');
            expect(state.persistent.titles).toBeArrayOfSize(2);
            expect(state.persistent.titles[1]).toBe('modified');
            const mod = state.persistent.titles.pop();
            expect(mod).toBe('modified');
            expect(state.persistent.titles).toBeArrayOfSize(1);
            state.persistent.titles.unshift('newFirst');
            expect(state.persistent.titles).toBeArrayOfSize(2);
            expect(state.persistent.titles[0]).toBe('newFirst');
            expect(state.persistent.titles[1]).toBe('Init');
            expect(state.persistent.titles.includes('Init')).toBeTrue();
        });
        expect(newState.persistent.titles).toBeArrayOfSize(2);
        expect(newState.persistent.titles[0]).toBe('newFirst');
        expect(newState.persistent.titles[1]).toBe('Init');
        expect(state.persistent.titles.includes('Init')).toBeTrue();
        expect(newState.persistent.titles.includes('Init')).toBeTrue();
        expect(newState.persistent.titles.includes('newFirst')).toBeTrue();
        expect(state.persistent.titles).toBeArrayOfSize(1);
        expect(state.persistent !== newState.persistent).toBeTrue();
        expect(state.persistent.goal === newState.persistent.goal).toBeTrue();
        expect(state.goals === newState.goals).toBeTrue();
    }

    {
        //same ref check
        expect(state.persistent.titles).toBeArrayOfSize(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.titles = state.persistent.titles;
            state.persistent.titles.unshift('newFirst');
            expect(state.persistent.titles).toBeArrayOfSize(2);
            expect(state.persistent.titles[0]).toBe('newFirst');
            expect(state.persistent.titles[1]).toBe('Init');
        });
        expect(newState.persistent.titles).toBeArrayOfSize(2);
        expect(newState.persistent.titles[0]).toBe('newFirst');
        expect(newState.persistent.titles[1]).toBe('Init');
        expect(state.persistent.titles).toBeArrayOfSize(1);
    }

    {
        //same ref check doesnt change anything
        expect(state.persistent.titles).toBeArrayOfSize(1);
        const newState = applyPatch(Object.freeze(state), (state) => {
            state.persistent.titles = state.persistent.titles;
        });
        expect(newState.persistent.titles).toBeArrayOfSize(1);
        expect(state.persistent.titles).toBeArrayOfSize(1);
        expect(state.persistent === newState.persistent).toBeTrue();
    }
});


test('patches', () => {
    const state = new State();
    state.goals.push(new Goal());
    state.persistent.titles.push('Init');

    expect(state.goals).toBeArrayOfSize(1);

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
