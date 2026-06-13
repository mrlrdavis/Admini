-- Create task_subtasks table to persist subtasks in the database
CREATE TABLE public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  assignee text,
  priority text CHECK (priority IS NULL OR priority IN ('low', 'normal', 'high', 'urgent')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_subtasks_task_id_idx ON public.task_subtasks (task_id, sort_order);

-- Updated at trigger
CREATE TRIGGER task_subtasks_set_updated_at
BEFORE UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

-- Members can read subtasks for tasks in their org
CREATE POLICY "members can read org task subtasks"
ON public.task_subtasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND public.is_org_member(tasks.organization_id)
  )
);

-- Members can create subtasks for tasks in their org
CREATE POLICY "members can create org task subtasks"
ON public.task_subtasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND public.is_org_member(tasks.organization_id)
  )
);

-- Members can update subtasks for tasks in their org
CREATE POLICY "members can update org task subtasks"
ON public.task_subtasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND public.is_org_member(tasks.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND public.is_org_member(tasks.organization_id)
  )
);

-- Members can delete subtasks for tasks in their org
CREATE POLICY "members can delete org task subtasks"
ON public.task_subtasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_subtasks.task_id
      AND public.is_org_member(tasks.organization_id)
  )
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_subtasks TO authenticated;