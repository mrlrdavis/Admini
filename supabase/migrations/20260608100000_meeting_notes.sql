-- Meeting Notes table
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text DEFAULT '',
  attendees text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_notes_org_created_idx ON public.meeting_notes (organization_id, created_at DESC);

-- RLS
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read org meeting notes"
ON public.meeting_notes FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY "members can create org meeting notes"
ON public.meeting_notes FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id)
  AND created_by = auth.uid()
);

CREATE POLICY "note creators can update their notes"
ON public.meeting_notes FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "note creators and managers can delete notes"
ON public.meeting_notes FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.can_manage_org(organization_id)
);

-- Updated_at trigger
CREATE TRIGGER meeting_notes_set_updated_at
BEFORE UPDATE ON public.meeting_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
