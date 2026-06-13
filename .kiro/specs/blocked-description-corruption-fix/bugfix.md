# Bugfix Requirements Document

## Introduction

This bugfix addresses a critical data corruption issue where the task description is incorrectly displayed as the "blocked reason" in the UI. When a task is marked as blocked/archived, the system displays `task.description` instead of `task.blockReason`, causing users to lose visibility of their actual task description content. This is vitally important because task descriptions contain essential information that users rely on for task context and execution.

The bug exists in two components (CalendarView and DashboardTab) while a third component (TaskSection) already implements the correct pattern using `task.blockReason`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a task has status 'archived' (blocked) AND the CalendarView tooltip is displayed THEN the system shows `task.description` as the blocked reason, corrupting the display of vital task information

1.2 WHEN a task is in the blocked tasks list on the DashboardTab THEN the system shows `task.description` as the blocked reason instead of the actual block reason

1.3 WHEN the DashboardTask type is used for blocked tasks THEN the system has no `blockReason` field available, forcing components to misuse `description`

### Expected Behavior (Correct)

2.1 WHEN a task has status 'archived' (blocked) AND the CalendarView tooltip is displayed THEN the system SHALL show `task.blockReason` as the blocked reason (or "Waiting on dependency" if not set), preserving the task description for its intended purpose

2.2 WHEN a task is in the blocked tasks list on the DashboardTab THEN the system SHALL show `task.blockReason` as the blocked reason (or "Blocked" if not set), keeping task description uncorrupted

2.3 WHEN the DashboardTask type is used for blocked tasks THEN the system SHALL have a `blockReason?: string` field available to store the actual reason a task is blocked

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a task is displayed with its description in tooltips THEN the system SHALL CONTINUE TO show the actual task description content correctly

3.2 WHEN a task has a valid description AND is not blocked THEN the system SHALL CONTINUE TO display that description as-is without modification

3.3 WHEN TaskSection displays blocked tasks with blockReason THEN the system SHALL CONTINUE TO work correctly using the existing pattern

3.4 WHEN a task's priority is displayed THEN the system SHALL CONTINUE TO show the correct priority value

3.5 WHEN subtask counts are shown in tooltips THEN the system SHALL CONTINUE TO calculate and display them correctly

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type TaskDisplayContext
  OUTPUT: boolean
  
  // Returns true when displaying block reason for blocked/archived tasks
  RETURN (X.task.status = 'archived' OR X.isBlockedTasksList = true) 
         AND X.displayingBlockReason = true
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - Block Reason Display
FOR ALL X WHERE isBugCondition(X) DO
  displayedText <- getBlockReasonDisplay'(X.task)
  ASSERT displayedText = X.task.blockReason OR 
         (X.task.blockReason IS NULL AND displayedText = defaultBlockedMessage)
  ASSERT displayedText != X.task.description (unless description equals blockReason)
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // Non-blocked task displays remain identical before and after fix
END FOR
```

Where:
- **F**: Original (unfixed) component rendering logic
- **F'**: Fixed component rendering logic using `blockReason` instead of `description`
