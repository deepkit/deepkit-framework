import 'jest';
import 'jest-extended';
import {classToPlain, f, getClassSchema} from "../index";

export class StateGoalChecklistItem {
    @f read: boolean = false;
    @f skipped: boolean = false;
}

export class StateGoal {
    @f.map(StateGoalChecklistItem) checklistItems: { [id: string]: StateGoalChecklistItem } = {};
}

export class PersistentState {
    @f goal: StateGoal = new StateGoal;
}

test('check freezed objects work with classToPlain', () => {
    const schema = getClassSchema(PersistentState);
    expect(schema.getProperty('goal').type).toBe('class');

    {
        //check default non-freeze first
        const state = new PersistentState();
        const plain = classToPlain(PersistentState, state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }

    {
        const state = Object.freeze(new PersistentState());
        Object.freeze(state.goal);
        Object.freeze(state.goal.checklistItems);
        const plain = classToPlain(PersistentState, state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
        console.log('class', state);
        console.log('plain', plain);
    }

    {
        const state = Object.seal(new PersistentState());
        const plain = classToPlain(PersistentState, state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }

    {
        const state = Object.preventExtensions(new PersistentState());
        const plain = classToPlain(PersistentState, state);
        expect(plain).not.toBeInstanceOf(PersistentState);
        expect(plain.goal).not.toBeInstanceOf(StateGoal);
        expect(plain.goal).not.toBe(state.goal);
    }
});
