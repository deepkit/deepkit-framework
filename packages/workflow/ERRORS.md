# @deepkit/workflow Errors

## DK-W001: Workflow Error

**Message:** Various workflow-related error messages including:
- `No event token found for {name}`
- `Can not apply state change from {currentState}->{nextState}. There's no transition between them or it was blocked.`
- `State {place} got the wrong event. Expected {expectedType}, got {actualType}`

**Causes:**
- Attempting to get an event token for a state that doesn't exist in the workflow
- Trying to transition between states that have no defined transition path
- A workflow transition was blocked by a guard condition
- Dispatching the wrong event type for a particular workflow state

**Solution:**
1. Verify that all states referenced in your workflow are defined in the workflow configuration.
2. Check that transitions are properly defined between the states you're trying to move between.
3. Review any guard conditions that may be blocking the transition.
4. Ensure event types match what the workflow state expects:

```typescript
const workflow = new Workflow<MyState>()
    .addPlace('draft')
    .addPlace('published')
    .addTransition('publish', 'draft', 'published');

// Make sure transitions exist before applying them
workflow.apply(item, 'publish');
```

---
