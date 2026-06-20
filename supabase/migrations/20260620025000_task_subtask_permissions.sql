-- Keep subtask permissions aligned with task permissions.
-- Staff can read org subtasks, but only task creators, admins, and principals
-- can create, update, complete, or delete subtasks on a task.

DROP POLICY IF EXISTS "members can create org task subtasks" ON public.task_subtasks;
CREATE POLICY "task owners and managers can create task subtasks"
ON public.task_subtasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND (
        public.can_manage_org(tasks.organization_id)
        OR tasks.created_by = (SELECT auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "members can update org task subtasks" ON public.task_subtasks;
CREATE POLICY "task owners and managers can update task subtasks"
ON public.task_subtasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND (
        public.can_manage_org(tasks.organization_id)
        OR tasks.created_by = (SELECT auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND (
        public.can_manage_org(tasks.organization_id)
        OR tasks.created_by = (SELECT auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "members can delete org task subtasks" ON public.task_subtasks;
CREATE POLICY "task owners and managers can delete task subtasks"
ON public.task_subtasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND (
        public.can_manage_org(tasks.organization_id)
        OR tasks.created_by = (SELECT auth.uid())
      )
  )
);
