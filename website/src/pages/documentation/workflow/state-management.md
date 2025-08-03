# State Management

Effective state management is crucial for building robust workflows. This guide covers advanced patterns for managing workflow states, transitions, and validation.

## State Design Patterns

### Linear Workflows

Simple workflows with sequential states:

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';

const documentWorkflow = createWorkflow('document', {
    draft: WorkflowEvent,
    review: WorkflowEvent,
    approved: WorkflowEvent,
    published: WorkflowEvent,
}, {
    draft: 'review',
    review: 'approved',
    approved: 'published',
});
```

### Branching Workflows

Workflows with multiple possible paths:

```typescript
const loanApplicationWorkflow = createWorkflow('loanApplication', {
    submitted: WorkflowEvent,
    initialReview: WorkflowEvent,
    approved: WorkflowEvent,
    rejected: WorkflowEvent,
    manualReview: WorkflowEvent,
    finalApproval: WorkflowEvent,
    finalRejection: WorkflowEvent,
}, {
    submitted: 'initialReview',
    initialReview: ['approved', 'rejected', 'manualReview'],
    manualReview: ['finalApproval', 'finalRejection'],
    // approved, rejected, finalApproval, finalRejection are terminal states
});
```

### Parallel State Workflows

Handle multiple concurrent processes:

```typescript
class OrderItemEvent extends WorkflowEvent {
    constructor(public itemId: string, public status: string) {
        super();
    }
}

const orderFulfillmentWorkflow = createWorkflow('orderFulfillment', {
    created: WorkflowEvent,
    inventoryCheck: WorkflowEvent,
    paymentProcessing: WorkflowEvent,
    inventoryReserved: OrderItemEvent,
    paymentCompleted: WorkflowEvent,
    readyToShip: WorkflowEvent,
    shipped: WorkflowEvent,
}, {
    created: ['inventoryCheck', 'paymentProcessing'], // Parallel processes
    inventoryCheck: 'inventoryReserved',
    paymentProcessing: 'paymentCompleted',
    // Both must complete before shipping
    inventoryReserved: 'readyToShip',
    paymentCompleted: 'readyToShip',
    readyToShip: 'shipped',
});
```

### Cyclical Workflows

Workflows that can return to previous states:

```typescript
const ticketWorkflow = createWorkflow('ticket', {
    open: WorkflowEvent,
    inProgress: WorkflowEvent,
    waitingForCustomer: WorkflowEvent,
    resolved: WorkflowEvent,
    closed: WorkflowEvent,
    reopened: WorkflowEvent,
}, {
    open: 'inProgress',
    inProgress: ['waitingForCustomer', 'resolved'],
    waitingForCustomer: ['inProgress', 'closed'], // Can go back to inProgress
    resolved: ['closed', 'reopened'], // Can be reopened
    reopened: 'inProgress', // Back to processing
    // closed is terminal
});
```

## State Validation

### Business Rule Validation

Implement complex business rules in state transitions:

```typescript
class ExpenseEvent extends WorkflowEvent {
    constructor(
        public amount: number,
        public category: string,
        public submittedBy: string
    ) {
        super();
    }
}

const expenseWorkflow = createWorkflow('expense', {
    submitted: ExpenseEvent,
    managerReview: WorkflowEvent,
    financeReview: WorkflowEvent,
    approved: WorkflowEvent,
    rejected: WorkflowEvent,
}, {
    submitted: ['managerReview', 'financeReview', 'approved'], // Multiple paths based on amount
    managerReview: ['approved', 'rejected', 'financeReview'],
    financeReview: ['approved', 'rejected'],
});

// Business rule: expenses over $1000 need finance review
dispatcher.listen(expenseWorkflow.onSubmitted, async (event) => {
    if (event.amount > 1000) {
        event.next('financeReview');
    } else if (event.amount > 100) {
        event.next('managerReview');
    } else {
        // Auto-approve small expenses
        event.next('approved');
    }
});

// Manager can escalate to finance
dispatcher.listen(expenseWorkflow.onManagerReview, async (event) => {
    const decision = await getManagerDecision(event.submittedBy);
    
    switch (decision.action) {
        case 'approve':
            event.next('approved');
            break;
        case 'reject':
            event.next('rejected');
            break;
        case 'escalate':
            event.next('financeReview');
            break;
    }
});
```

### Conditional Transitions

Use guards to control when transitions are allowed:

```typescript
class GuardedWorkflow {
    private conditions = new Map<string, boolean>();
    
    setCondition(name: string, value: boolean) {
        this.conditions.set(name, value);
    }
    
    checkCondition(name: string): boolean {
        return this.conditions.get(name) ?? false;
    }
}

const guardedWorkflow = new GuardedWorkflow();

const deploymentWorkflow = createWorkflow('deployment', {
    pending: WorkflowEvent,
    testing: WorkflowEvent,
    staging: WorkflowEvent,
    production: WorkflowEvent,
    rollback: WorkflowEvent,
}, {
    pending: 'testing',
    testing: ['staging', 'rollback'],
    staging: ['production', 'rollback'],
    production: 'rollback', // Can rollback from production
});

dispatcher.listen(deploymentWorkflow.onTesting, async (event) => {
    const testsPass = await runTests();
    guardedWorkflow.setCondition('testsPass', testsPass);
    
    if (testsPass) {
        event.next('staging');
    } else {
        event.next('rollback');
    }
});

dispatcher.listen(deploymentWorkflow.onStaging, async (event) => {
    const stagingValid = await validateStaging();
    const approvalReceived = guardedWorkflow.checkCondition('approvalReceived');
    
    if (stagingValid && approvalReceived) {
        event.next('production');
    } else {
        event.next('rollback');
    }
});
```

## State Persistence

### Custom State Storage

Implement custom state storage for persistence:

```typescript
interface WorkflowState<T> {
    get(): keyof T & string;
    set(v: keyof T & string): void;
}

class DatabaseWorkflowState<T extends WorkflowPlaces> implements WorkflowState<T> {
    constructor(
        private workflowId: string,
        private database: Database,
        private initialState: keyof T & string
    ) {}

    get(): keyof T & string {
        // Load from database
        const record = this.database.query(
            'SELECT state FROM workflows WHERE id = ?', 
            [this.workflowId]
        );
        return record?.state || this.initialState;
    }

    set(state: keyof T & string): void {
        // Save to database
        this.database.execute(
            'UPDATE workflows SET state = ?, updated_at = NOW() WHERE id = ?',
            [state, this.workflowId]
        );
    }
}

// Use custom state storage
const customState = new DatabaseWorkflowState('workflow-123', database, 'pending');
const workflow = new Workflow(definition, customState, dispatcher, injector);
```

### State History

Track state transition history:

```typescript
class StateHistoryTracker<T extends WorkflowPlaces> implements WorkflowState<T> {
    private history: Array<{
        state: keyof T & string;
        timestamp: Date;
        event?: any;
    }> = [];

    constructor(private currentState: keyof T & string) {
        this.history.push({
            state: currentState,
            timestamp: new Date()
        });
    }

    get(): keyof T & string {
        return this.currentState;
    }

    set(state: keyof T & string): void {
        this.history.push({
            state,
            timestamp: new Date()
        });
        this.currentState = state;
    }

    getHistory() {
        return [...this.history];
    }

    getPreviousState(): keyof T & string | undefined {
        return this.history[this.history.length - 2]?.state;
    }

    getStateAt(timestamp: Date): keyof T & string | undefined {
        const entry = this.history
            .filter(h => h.timestamp <= timestamp)
            .pop();
        return entry?.state;
    }
}
```

## State Queries and Inspection

### Workflow State Inspection

Query workflow state and capabilities:

```typescript
class WorkflowInspector<T extends WorkflowPlaces> {
    constructor(private workflow: Workflow<T>) {}

    getCurrentState(): keyof T & string {
        return this.workflow.state.get();
    }

    getPossibleTransitions(): (keyof T & string)[] {
        return this.workflow.definition.getTransitionsFrom(this.getCurrentState());
    }

    canTransitionTo(state: keyof T & string): boolean {
        return this.workflow.can(state);
    }

    isInFinalState(): boolean {
        return this.workflow.isDone();
    }

    getReachableStates(): (keyof T & string)[] {
        const visited = new Set<keyof T & string>();
        const queue = [this.getCurrentState()];
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            
            visited.add(current);
            const transitions = this.workflow.definition.getTransitionsFrom(current);
            queue.push(...transitions);
        }
        
        return Array.from(visited);
    }

    getShortestPathTo(targetState: keyof T & string): (keyof T & string)[] | null {
        const queue: Array<{state: keyof T & string, path: (keyof T & string)[]}> = [
            { state: this.getCurrentState(), path: [this.getCurrentState()] }
        ];
        const visited = new Set<keyof T & string>();

        while (queue.length > 0) {
            const { state, path } = queue.shift()!;
            
            if (state === targetState) {
                return path;
            }
            
            if (visited.has(state)) continue;
            visited.add(state);
            
            const transitions = this.workflow.definition.getTransitionsFrom(state);
            for (const nextState of transitions) {
                queue.push({
                    state: nextState,
                    path: [...path, nextState]
                });
            }
        }
        
        return null; // No path found
    }
}

// Usage
const inspector = new WorkflowInspector(orderWorkflow);

console.log('Current state:', inspector.getCurrentState());
console.log('Possible transitions:', inspector.getPossibleTransitions());
console.log('Can ship?', inspector.canTransitionTo('shipped'));
console.log('Is done?', inspector.isInFinalState());
console.log('Reachable states:', inspector.getReachableStates());
console.log('Path to delivered:', inspector.getShortestPathTo('delivered'));
```

### Workflow Visualization

Generate workflow diagrams:

```typescript
class WorkflowVisualizer<T extends WorkflowPlaces> {
    constructor(private definition: WorkflowDefinition<T>) {}

    generateMermaidDiagram(): string {
        const states = Object.keys(this.definition.places);
        const transitions = this.definition.transitions;
        
        let diagram = 'stateDiagram-v2\n';
        
        // Add states
        for (const state of states) {
            diagram += `    ${state}\n`;
        }
        
        // Add transitions
        for (const transition of transitions) {
            diagram += `    ${transition.from} --> ${transition.to}`;
            if (transition.label) {
                diagram += ` : ${transition.label}`;
            }
            diagram += '\n';
        }
        
        return diagram;
    }

    generateDotGraph(): string {
        const states = Object.keys(this.definition.places);
        const transitions = this.definition.transitions;
        
        let graph = 'digraph workflow {\n';
        graph += '    rankdir=LR;\n';
        
        // Add states
        for (const state of states) {
            const isTerminal = this.definition.getTransitionsFrom(state).length === 0;
            const shape = isTerminal ? 'doublecircle' : 'circle';
            graph += `    ${state} [shape=${shape}];\n`;
        }
        
        // Add transitions
        for (const transition of transitions) {
            graph += `    ${transition.from} -> ${transition.to}`;
            if (transition.label) {
                graph += ` [label="${transition.label}"]`;
            }
            graph += ';\n';
        }
        
        graph += '}';
        return graph;
    }
}

// Usage
const visualizer = new WorkflowVisualizer(orderWorkflow);
console.log(visualizer.generateMermaidDiagram());
console.log(visualizer.generateDotGraph());
```

## State Machine Patterns

### State Pattern Implementation

Implement the State pattern with workflows:

```typescript
abstract class OrderState {
    abstract handle(context: OrderContext): Promise<void>;
    abstract canTransitionTo(state: string): boolean;
}

class OrderContext {
    constructor(
        private workflow: Workflow<any>,
        private orderData: any
    ) {}

    async setState(stateName: string, event?: any) {
        await this.workflow.apply(stateName, event);
    }

    getCurrentState(): string {
        return this.workflow.state.get();
    }

    canTransitionTo(state: string): boolean {
        return this.workflow.can(state);
    }
}

class CreatedState extends OrderState {
    async handle(context: OrderContext): Promise<void> {
        // Validate order
        const isValid = await this.validateOrder(context);
        if (isValid) {
            await context.setState('processing');
        } else {
            await context.setState('cancelled');
        }
    }

    canTransitionTo(state: string): boolean {
        return ['processing', 'cancelled'].includes(state);
    }

    private async validateOrder(context: OrderContext): Promise<boolean> {
        // Validation logic
        return true;
    }
}

class ProcessingState extends OrderState {
    async handle(context: OrderContext): Promise<void> {
        // Process payment
        const paymentResult = await this.processPayment(context);
        if (paymentResult.success) {
            await context.setState('paid');
        } else {
            await context.setState('paymentFailed');
        }
    }

    canTransitionTo(state: string): boolean {
        return ['paid', 'paymentFailed', 'cancelled'].includes(state);
    }

    private async processPayment(context: OrderContext): Promise<{success: boolean}> {
        // Payment processing logic
        return { success: true };
    }
}
```

### Hierarchical State Machines

Implement nested state machines:

```typescript
const parentWorkflow = createWorkflow('parent', {
    active: WorkflowEvent,
    inactive: WorkflowEvent,
}, {
    active: 'inactive',
    inactive: 'active',
});

const childWorkflow = createWorkflow('child', {
    idle: WorkflowEvent,
    working: WorkflowEvent,
    completed: WorkflowEvent,
}, {
    idle: 'working',
    working: 'completed',
    completed: 'idle',
});

class HierarchicalWorkflowManager {
    constructor(
        private parent: Workflow<any>,
        private child: Workflow<any>
    ) {}

    async activateParent() {
        await this.parent.apply('active');
        // Child can only work when parent is active
        if (this.child.state.get() === 'idle') {
            await this.child.apply('working');
        }
    }

    async deactivateParent() {
        // Stop child work when parent becomes inactive
        if (this.child.state.get() === 'working') {
            await this.child.apply('completed');
        }
        await this.parent.apply('inactive');
    }
}
```

## Next Steps

- [Dependency Injection](./dependency-injection.md) - Integrating workflows with DI
- [Testing](./testing.md) - Testing complex state management
- [Advanced Features](./advanced-features.md) - Performance and debugging
- [Events](./events.md) - Advanced event handling patterns
