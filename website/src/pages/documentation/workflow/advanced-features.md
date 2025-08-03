# Advanced Features

This guide covers advanced workflow features including performance optimization, debugging, monitoring, and integration patterns for production applications.

## Performance Optimization

### Compiled State Transitions

Deepkit's workflow engine compiles state transition logic for maximum performance:

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher } from '@deepkit/event';
import { Stopwatch } from '@deepkit/stopwatch';

const performantWorkflow = createWorkflow('performant', {
    start: WorkflowEvent,
    processing: WorkflowEvent,
    completed: WorkflowEvent,
}, {
    start: 'processing',
    processing: 'completed',
});

// Performance measurement
async function measureWorkflowPerformance() {
    const dispatcher = new EventDispatcher();
    const stopwatch = new Stopwatch();
    
    const workflow = performantWorkflow.create('start', dispatcher, undefined, stopwatch);
    
    // First call compiles the transition logic
    stopwatch.start('first-transition');
    await workflow.apply('processing');
    const firstTime = stopwatch.end('first-transition');
    
    // Subsequent calls use compiled version (much faster)
    const workflow2 = performantWorkflow.create('start', dispatcher, undefined, stopwatch);
    stopwatch.start('second-transition');
    await workflow2.apply('processing');
    const secondTime = stopwatch.end('second-transition');
    
    console.log(`First transition: ${firstTime}ms`);
    console.log(`Second transition: ${secondTime}ms`);
    console.log(`Performance improvement: ${((firstTime - secondTime) / firstTime * 100).toFixed(1)}%`);
}
```

### Batch Processing

Process multiple workflows efficiently:

```typescript
class WorkflowBatchProcessor {
    private batches = new Map<string, Array<{workflow: Workflow<any>, state: string, event?: any}>>();
    
    addToBatch(workflowType: string, workflow: Workflow<any>, state: string, event?: any) {
        if (!this.batches.has(workflowType)) {
            this.batches.set(workflowType, []);
        }
        this.batches.get(workflowType)!.push({ workflow, state, event });
    }
    
    async processBatches(): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const [workflowType, batch] of this.batches) {
            // Process each batch in parallel
            const batchPromise = this.processBatch(batch);
            promises.push(batchPromise);
        }
        
        await Promise.all(promises);
        this.batches.clear();
    }
    
    private async processBatch(batch: Array<{workflow: Workflow<any>, state: string, event?: any}>): Promise<void> {
        // Process workflows in parallel within the batch
        const promises = batch.map(({ workflow, state, event }) => 
            workflow.apply(state, event)
        );
        
        await Promise.all(promises);
    }
}

// Usage
const batchProcessor = new WorkflowBatchProcessor();

// Add workflows to batch
for (let i = 0; i < 1000; i++) {
    const workflow = performantWorkflow.create('start', dispatcher);
    batchProcessor.addToBatch('performant', workflow, 'processing');
}

// Process all batches efficiently
await batchProcessor.processBatches();
```

### Memory-Efficient State Storage

Implement memory-efficient state storage for large-scale workflows:

```typescript
interface CompactWorkflowState<T> {
    workflowId: string;
    currentState: keyof T & string;
    metadata?: Record<string, any>;
}

class CompactStateManager<T extends WorkflowPlaces> {
    private states = new Map<string, CompactWorkflowState<T>>();
    private statePool: CompactWorkflowState<T>[] = [];
    
    createState(workflowId: string, initialState: keyof T & string): CompactWorkflowState<T> {
        // Reuse objects from pool to reduce GC pressure
        let state = this.statePool.pop();
        if (!state) {
            state = { workflowId: '', currentState: initialState, metadata: {} };
        }
        
        state.workflowId = workflowId;
        state.currentState = initialState;
        state.metadata = {};
        
        this.states.set(workflowId, state);
        return state;
    }
    
    updateState(workflowId: string, newState: keyof T & string): void {
        const state = this.states.get(workflowId);
        if (state) {
            state.currentState = newState;
        }
    }
    
    removeState(workflowId: string): void {
        const state = this.states.get(workflowId);
        if (state) {
            this.states.delete(workflowId);
            // Return to pool for reuse
            this.statePool.push(state);
        }
    }
    
    getState(workflowId: string): CompactWorkflowState<T> | undefined {
        return this.states.get(workflowId);
    }
    
    getStats() {
        return {
            activeStates: this.states.size,
            pooledStates: this.statePool.length,
            memoryUsage: process.memoryUsage()
        };
    }
}
```

## Debugging and Monitoring

### Workflow Debugging

Add comprehensive debugging capabilities:

```typescript
class WorkflowDebugger<T extends WorkflowPlaces> {
    private transitionLog: Array<{
        timestamp: Date;
        workflowId: string;
        from: keyof T & string;
        to: keyof T & string;
        event?: any;
        duration?: number;
    }> = [];
    
    constructor(private workflow: Workflow<T>, private workflowId: string) {
        this.setupDebugListeners();
    }
    
    private setupDebugListeners() {
        // Intercept all state transitions
        const originalApply = this.workflow.apply.bind(this.workflow);
        
        this.workflow.apply = async (nextState: any, event?: any) => {
            const startTime = Date.now();
            const fromState = this.workflow.state.get();
            
            console.log(`[${this.workflowId}] Transitioning from ${fromState} to ${nextState}`);
            
            try {
                await originalApply(nextState, event);
                
                const duration = Date.now() - startTime;
                this.transitionLog.push({
                    timestamp: new Date(),
                    workflowId: this.workflowId,
                    from: fromState,
                    to: nextState,
                    event,
                    duration
                });
                
                console.log(`[${this.workflowId}] Transition completed in ${duration}ms`);
            } catch (error) {
                console.error(`[${this.workflowId}] Transition failed:`, error);
                throw error;
            }
        };
    }
    
    getTransitionLog() {
        return [...this.transitionLog];
    }
    
    getTransitionStats() {
        const stats = new Map<string, {count: number, totalDuration: number, avgDuration: number}>();
        
        for (const log of this.transitionLog) {
            const key = `${log.from}->${log.to}`;
            const existing = stats.get(key) || {count: 0, totalDuration: 0, avgDuration: 0};
            
            existing.count++;
            existing.totalDuration += log.duration || 0;
            existing.avgDuration = existing.totalDuration / existing.count;
            
            stats.set(key, existing);
        }
        
        return Object.fromEntries(stats);
    }
    
    exportDebugData() {
        return {
            workflowId: this.workflowId,
            currentState: this.workflow.state.get(),
            isDone: this.workflow.isDone(),
            transitionLog: this.getTransitionLog(),
            stats: this.getTransitionStats()
        };
    }
}

// Usage
const workflow = performantWorkflow.create('start', dispatcher);
const debugger = new WorkflowDebugger(workflow, 'debug-workflow-1');

await workflow.apply('processing');
await workflow.apply('completed');

console.log('Debug data:', debugger.exportDebugData());
```

### Performance Monitoring

Monitor workflow performance in production:

```typescript
class WorkflowMonitor {
    private metrics = {
        transitionsPerSecond: 0,
        averageTransitionTime: 0,
        errorRate: 0,
        activeWorkflows: 0,
        totalTransitions: 0,
        totalErrors: 0,
    };
    
    private transitionTimes: number[] = [];
    private lastMetricsUpdate = Date.now();
    
    recordTransition(duration: number) {
        this.metrics.totalTransitions++;
        this.transitionTimes.push(duration);
        
        // Keep only last 1000 measurements
        if (this.transitionTimes.length > 1000) {
            this.transitionTimes.shift();
        }
        
        this.updateMetrics();
    }
    
    recordError() {
        this.metrics.totalErrors++;
        this.updateMetrics();
    }
    
    recordActiveWorkflow(delta: number) {
        this.metrics.activeWorkflows += delta;
    }
    
    private updateMetrics() {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastMetricsUpdate;
        
        if (timeSinceLastUpdate >= 1000) { // Update every second
            this.metrics.transitionsPerSecond = this.metrics.totalTransitions / (timeSinceLastUpdate / 1000);
            this.metrics.averageTransitionTime = this.transitionTimes.reduce((a, b) => a + b, 0) / this.transitionTimes.length;
            this.metrics.errorRate = this.metrics.totalErrors / this.metrics.totalTransitions;
            
            this.lastMetricsUpdate = now;
        }
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
    
    getHealthStatus() {
        const metrics = this.getMetrics();
        
        return {
            healthy: metrics.errorRate < 0.01 && metrics.averageTransitionTime < 100,
            metrics,
            alerts: [
                ...(metrics.errorRate > 0.05 ? ['High error rate'] : []),
                ...(metrics.averageTransitionTime > 500 ? ['Slow transitions'] : []),
                ...(metrics.activeWorkflows > 10000 ? ['High workflow count'] : []),
            ]
        };
    }
}

// Global monitor instance
const workflowMonitor = new WorkflowMonitor();

// Integrate with workflow events
class MonitoredWorkflowService {
    @eventDispatcher.listen(performantWorkflow.onStart)
    async onStart(event: any) {
        workflowMonitor.recordActiveWorkflow(1);
        
        const startTime = Date.now();
        try {
            // Process the event
            await this.processStart(event);
            workflowMonitor.recordTransition(Date.now() - startTime);
        } catch (error) {
            workflowMonitor.recordError();
            throw error;
        }
    }
    
    @eventDispatcher.listen(performantWorkflow.onCompleted)
    async onCompleted(event: any) {
        workflowMonitor.recordActiveWorkflow(-1);
    }
    
    private async processStart(event: any) {
        // Business logic
    }
}
```

## Integration Patterns

### Workflow Orchestration

Orchestrate multiple workflows:

```typescript
class WorkflowOrchestrator {
    private workflows = new Map<string, Workflow<any>>();
    private dependencies = new Map<string, string[]>();
    
    registerWorkflow(id: string, workflow: Workflow<any>, dependencies: string[] = []) {
        this.workflows.set(id, workflow);
        this.dependencies.set(id, dependencies);
    }
    
    async executeWorkflows(): Promise<void> {
        const completed = new Set<string>();
        const inProgress = new Set<string>();
        
        while (completed.size < this.workflows.size) {
            const ready = this.getReadyWorkflows(completed, inProgress);
            
            if (ready.length === 0) {
                throw new Error('Circular dependency or deadlock detected');
            }
            
            // Execute ready workflows in parallel
            const promises = ready.map(async (workflowId) => {
                inProgress.add(workflowId);
                const workflow = this.workflows.get(workflowId)!;
                
                try {
                    await this.executeWorkflow(workflow);
                    completed.add(workflowId);
                } finally {
                    inProgress.delete(workflowId);
                }
            });
            
            await Promise.all(promises);
        }
    }
    
    private getReadyWorkflows(completed: Set<string>, inProgress: Set<string>): string[] {
        const ready: string[] = [];
        
        for (const [workflowId, deps] of this.dependencies) {
            if (completed.has(workflowId) || inProgress.has(workflowId)) {
                continue;
            }
            
            const allDepsCompleted = deps.every(dep => completed.has(dep));
            if (allDepsCompleted) {
                ready.push(workflowId);
            }
        }
        
        return ready;
    }
    
    private async executeWorkflow(workflow: Workflow<any>): Promise<void> {
        while (!workflow.isDone()) {
            const currentState = workflow.state.get();
            const possibleTransitions = workflow.definition.getTransitionsFrom(currentState);
            
            if (possibleTransitions.length === 0) {
                break; // No more transitions possible
            }
            
            // Apply the first possible transition (customize as needed)
            await workflow.apply(possibleTransitions[0]);
        }
    }
}

// Usage
const orchestrator = new WorkflowOrchestrator();

const userWorkflow = createWorkflow('user', {
    created: WorkflowEvent,
    verified: WorkflowEvent,
}, { created: 'verified' });

const orderWorkflow = createWorkflow('order', {
    created: WorkflowEvent,
    processed: WorkflowEvent,
}, { created: 'processed' });

const paymentWorkflow = createWorkflow('payment', {
    pending: WorkflowEvent,
    completed: WorkflowEvent,
}, { pending: 'completed' });

// Register workflows with dependencies
orchestrator.registerWorkflow('user', userWorkflow.create('created', dispatcher));
orchestrator.registerWorkflow('order', orderWorkflow.create('created', dispatcher), ['user']);
orchestrator.registerWorkflow('payment', paymentWorkflow.create('pending', dispatcher), ['order']);

// Execute all workflows in dependency order
await orchestrator.executeWorkflows();
```

### Event Sourcing Integration

Integrate workflows with event sourcing:

```typescript
interface WorkflowEvent {
    id: string;
    workflowId: string;
    eventType: string;
    data: any;
    timestamp: Date;
    version: number;
}

class EventSourcingWorkflowStore {
    private events: WorkflowEvent[] = [];
    private snapshots = new Map<string, {state: string, version: number}>();
    
    async saveEvent(workflowId: string, eventType: string, data: any): Promise<void> {
        const event: WorkflowEvent = {
            id: `event_${Date.now()}_${Math.random()}`,
            workflowId,
            eventType,
            data,
            timestamp: new Date(),
            version: this.getNextVersion(workflowId)
        };
        
        this.events.push(event);
        
        // Create snapshot every 10 events
        if (event.version % 10 === 0) {
            await this.createSnapshot(workflowId, data.newState, event.version);
        }
    }
    
    async loadWorkflowState(workflowId: string): Promise<{state: string, version: number}> {
        const snapshot = this.snapshots.get(workflowId);
        let state = 'created';
        let version = 0;
        
        if (snapshot) {
            state = snapshot.state;
            version = snapshot.version;
        }
        
        // Replay events after snapshot
        const eventsToReplay = this.events
            .filter(e => e.workflowId === workflowId && e.version > version)
            .sort((a, b) => a.version - b.version);
        
        for (const event of eventsToReplay) {
            if (event.eventType === 'StateTransition') {
                state = event.data.newState;
                version = event.version;
            }
        }
        
        return { state, version };
    }
    
    private getNextVersion(workflowId: string): number {
        const workflowEvents = this.events.filter(e => e.workflowId === workflowId);
        return workflowEvents.length + 1;
    }
    
    private async createSnapshot(workflowId: string, state: string, version: number): Promise<void> {
        this.snapshots.set(workflowId, { state, version });
    }
    
    getEventHistory(workflowId: string): WorkflowEvent[] {
        return this.events
            .filter(e => e.workflowId === workflowId)
            .sort((a, b) => a.version - b.version);
    }
}

// Event-sourced workflow wrapper
class EventSourcedWorkflow<T extends WorkflowPlaces> {
    constructor(
        private workflowId: string,
        private definition: WorkflowDefinition<T>,
        private eventStore: EventSourcingWorkflowStore,
        private dispatcher: EventDispatcher
    ) {}
    
    async apply(nextState: keyof T & string, event?: any): Promise<void> {
        const currentState = await this.getCurrentState();
        
        // Save the transition event
        await this.eventStore.saveEvent(this.workflowId, 'StateTransition', {
            fromState: currentState,
            toState: nextState,
            event: event
        });
        
        // Create temporary workflow for validation and execution
        const workflow = new Workflow(
            this.definition,
            { get: () => currentState, set: () => {} },
            this.dispatcher,
            this.dispatcher.injector
        );
        
        await workflow.apply(nextState, event);
    }
    
    async getCurrentState(): Promise<keyof T & string> {
        const { state } = await this.eventStore.loadWorkflowState(this.workflowId);
        return state as keyof T & string;
    }
    
    async getHistory(): Promise<WorkflowEvent[]> {
        return this.eventStore.getEventHistory(this.workflowId);
    }
}
```

## Production Considerations

### Error Recovery

Implement robust error recovery:

```typescript
class WorkflowErrorRecovery {
    private retryAttempts = new Map<string, number>();
    private maxRetries = 3;
    private retryDelay = 1000; // 1 second
    
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        workflowId: string,
        context: string
    ): Promise<T> {
        const attempts = this.retryAttempts.get(workflowId) || 0;
        
        try {
            const result = await operation();
            this.retryAttempts.delete(workflowId); // Reset on success
            return result;
        } catch (error) {
            if (attempts < this.maxRetries) {
                this.retryAttempts.set(workflowId, attempts + 1);
                
                console.warn(`Workflow ${workflowId} failed in ${context}, retrying (${attempts + 1}/${this.maxRetries})`);
                
                await this.delay(this.retryDelay * Math.pow(2, attempts)); // Exponential backoff
                return this.executeWithRetry(operation, workflowId, context);
            } else {
                console.error(`Workflow ${workflowId} failed permanently in ${context}:`, error);
                this.retryAttempts.delete(workflowId);
                throw error;
            }
        }
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Health Checks

Implement workflow health monitoring:

```typescript
class WorkflowHealthChecker {
    async checkHealth(): Promise<{healthy: boolean, details: any}> {
        const checks = await Promise.allSettled([
            this.checkEventDispatcher(),
            this.checkWorkflowPerformance(),
            this.checkMemoryUsage(),
            this.checkErrorRates(),
        ]);
        
        const results = checks.map((check, index) => ({
            name: ['eventDispatcher', 'performance', 'memory', 'errors'][index],
            status: check.status,
            result: check.status === 'fulfilled' ? check.value : check.reason
        }));
        
        const healthy = results.every(r => r.status === 'fulfilled' && r.result.healthy);
        
        return { healthy, details: results };
    }
    
    private async checkEventDispatcher(): Promise<{healthy: boolean, details: any}> {
        // Check if event dispatcher is responsive
        return { healthy: true, details: 'Event dispatcher operational' };
    }
    
    private async checkWorkflowPerformance(): Promise<{healthy: boolean, details: any}> {
        const metrics = workflowMonitor.getMetrics();
        return {
            healthy: metrics.averageTransitionTime < 1000,
            details: metrics
        };
    }
    
    private async checkMemoryUsage(): Promise<{healthy: boolean, details: any}> {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        
        return {
            healthy: heapUsedMB < 512, // Less than 512MB
            details: { heapUsedMB, ...usage }
        };
    }
    
    private async checkErrorRates(): Promise<{healthy: boolean, details: any}> {
        const metrics = workflowMonitor.getMetrics();
        return {
            healthy: metrics.errorRate < 0.05, // Less than 5% error rate
            details: { errorRate: metrics.errorRate }
        };
    }
}
```

## Next Steps

- [Getting Started](./getting-started.md) - Basic workflow concepts
- [Events](./events.md) - Event handling patterns
- [State Management](./state-management.md) - Advanced state patterns
- [Testing](./testing.md) - Comprehensive testing strategies
