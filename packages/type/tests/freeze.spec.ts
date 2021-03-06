import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getClassSchema, jsonSerializer, t } from '../index';

export class StateGoalChecklistItem {
    @t read: boolean = false;
    @t skipped: boolean = false;
}

export class StateGoal {
    @t.map(StateGoalChecklistItem) checklistItems: { [id: string]: StateGoalChecklistItem } = {};
}

export class PersistentState {
    @t goal: StateGoal = new StateGoal;
}

test('check freezed objects work with classToPlain', () => {
    const schema = getClassSchema(PersistentState);
    expect(schema.getProperty('goal').type).toBe('class');

    {
        //check default non-freeze first
        const state = new PersistentState();
        const plain = jsonSerializer.for(PersistentState).serialize(state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }

    {
        const state = Object.freeze(new PersistentState());
        Object.freeze(state.goal);
        Object.freeze(state.goal.checklistItems);
        const plain = jsonSerializer.for(PersistentState).serialize(state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }

    {
        const state = Object.seal(new PersistentState());
        const plain = jsonSerializer.for(PersistentState).serialize(state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }

    {
        const state = Object.preventExtensions(new PersistentState());
        const plain = jsonSerializer.for(PersistentState).serialize(state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }
});
