-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM service_role;

CREATE FUNCTION public.can_student_read_student (
  target_student_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_students my_class
    join public.students me on me.id = my_class.student_id
    join public.class_students target_class
      on target_class.class_id = my_class.class_id
    where me.auth_user_id = auth.uid()
      and me.status = 'active'
      and target_class.student_id = target_student_id
  );
$function$;

REVOKE ALL ON FUNCTION public.can_student_read_student(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.can_student_read_student(uuid) TO authenticated;

CREATE FUNCTION public.can_student_read_teacher (
  target_teacher_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    join public.class_teachers ct on ct.class_id = cs.class_id
    join public.teachers t on t.id = ct.teacher_id
    where s.auth_user_id = auth.uid()
      and s.status = 'active'
      and t.id = target_teacher_id
      and t.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.can_student_read_teacher(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.can_student_read_teacher(uuid) TO authenticated;

CREATE FUNCTION public.can_teacher_manage_lesson (
  target_lesson_record_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.lesson_records lr
    where lr.id = target_lesson_record_id
      and public.is_current_teacher(lr.teacher_id)
      and public.is_teacher_of_class(lr.class_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.can_teacher_manage_lesson(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.can_teacher_manage_lesson(uuid) TO authenticated;

CREATE FUNCTION public.can_teacher_read_lesson (
  target_lesson_record_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.lesson_records lr
    where lr.id = target_lesson_record_id
      and public.is_teacher_of_class(lr.class_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.can_teacher_read_lesson(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.can_teacher_read_lesson(uuid) TO authenticated;

CREATE FUNCTION public.can_teacher_read_student (
  target_student_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_students cs
    where cs.student_id = target_student_id
      and public.is_teacher_of_class(cs.class_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.can_teacher_read_student(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.can_teacher_read_student(uuid) TO authenticated;

CREATE FUNCTION public.current_admin_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select a.id
  from public.admins a
  where a.auth_user_id = auth.uid()
    and a.status = 'active'
  limit 1
$function$;

REVOKE ALL ON FUNCTION public.current_admin_id() FROM PUBLIC;

GRANT ALL ON FUNCTION public.current_admin_id() TO authenticated;

CREATE FUNCTION public.is_current_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.admins
    where auth_user_id = auth.uid()
      and status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_current_admin() FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_current_admin() TO authenticated;

CREATE FUNCTION public.is_current_student (
  target_student_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.auth_user_id = (select auth.uid())
      and s.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_current_student(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_current_student(uuid) TO authenticated;

CREATE FUNCTION public.is_current_teacher (
  target_teacher_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.teachers
    where id = target_teacher_id
      and auth_user_id = auth.uid()
      and status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_current_teacher(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_current_teacher(uuid) TO authenticated;

CREATE FUNCTION public.is_goal_in_class (
  target_goal_id  uuid,
  target_class_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.teaching_goals tg
    where tg.id = target_goal_id
      and tg.class_id = target_class_id
  );
$function$;

REVOKE ALL ON FUNCTION public.is_goal_in_class(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_goal_in_class(uuid, uuid) TO authenticated;

CREATE FUNCTION public.is_student_in_lesson_class (
  target_lesson_record_id uuid,
  target_student_id       uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.lesson_records lr
    join public.class_students cs
      on cs.class_id = lr.class_id
    where lr.id = target_lesson_record_id
      and cs.student_id = target_student_id
  );
$function$;

REVOKE ALL ON FUNCTION public.is_student_in_lesson_class(uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_student_in_lesson_class(uuid, uuid) TO authenticated;

CREATE FUNCTION public.is_student_of_class (
  target_class_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = target_class_id
      and s.auth_user_id = auth.uid()
      and s.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_student_of_class(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_student_of_class(uuid) TO authenticated;

CREATE FUNCTION public.is_teacher_of_class (
  target_class_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_teachers ct
    join public.teachers t on t.id = ct.teacher_id
    where ct.class_id = target_class_id
      and t.auth_user_id = auth.uid()
      and t.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;

CREATE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

CREATE FUNCTION public.update_my_teacher_display_name (
  new_display_name text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update public.teachers
  set display_name = nullif(trim(new_display_name), '')
  where auth_user_id = auth.uid()
    and status = 'active';
end;
$function$;

REVOKE ALL ON FUNCTION public.update_my_teacher_display_name(text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_my_teacher_display_name(text) TO authenticated;

CREATE TABLE public.admin_action_approvals (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid                     NOT NULL,
  admin_name text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  admin_id   uuid
);

ALTER TABLE public.admin_action_approvals
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_action_approvals
  ADD CONSTRAINT admin_action_approvals_pkey PRIMARY KEY (id);

ALTER TABLE public.admin_action_approvals
  ADD CONSTRAINT admin_action_approvals_request_id_admin_name_key UNIQUE (request_id, admin_name);

GRANT ALL ON public.admin_action_approvals TO anon;

GRANT ALL ON public.admin_action_approvals TO authenticated;

GRANT ALL ON public.admin_action_approvals TO service_role;

CREATE UNIQUE INDEX admin_action_approvals_request_admin_id_unique ON public.admin_action_approvals (request_id, admin_id)
  WHERE admin_id IS NOT NULL;

CREATE POLICY "Admins can read all admin action approvals" ON public.admin_action_approvals
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can create own action approvals" ON public.admin_action_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK ((public.is_current_admin() AND (admin_id = public.current_admin_id())));

CREATE POLICY "admins can delete action approvals" ON public.admin_action_approvals
  FOR DELETE
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can read action approvals" ON public.admin_action_approvals
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can update action approvals" ON public.admin_action_approvals
  FOR UPDATE
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE TABLE public.admin_action_requests (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  action_type        text                     NOT NULL,
  target_type        text                     NOT NULL,
  target_id          uuid                     NOT NULL,
  target_name        text                     NOT NULL,
  status             text                     DEFAULT 'pending'::text NOT NULL,
  approvals_count    integer                  DEFAULT 0 NOT NULL,
  required_approvals integer                  NOT NULL,
  requested_by       text,
  note               text,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  action_payload     jsonb
);

ALTER TABLE public.admin_action_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_action_requests
  ADD CONSTRAINT admin_action_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.admin_action_approvals
  ADD CONSTRAINT admin_action_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.admin_action_requests(id) ON DELETE CASCADE;

GRANT ALL ON public.admin_action_requests TO anon;

GRANT ALL ON public.admin_action_requests TO authenticated;

GRANT ALL ON public.admin_action_requests TO service_role;

CREATE POLICY "Admins can read all admin action requests" ON public.admin_action_requests
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can create action requests" ON public.admin_action_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_admin());

CREATE POLICY "admins can delete action requests" ON public.admin_action_requests
  FOR DELETE
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can read action requests" ON public.admin_action_requests
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can update action requests" ON public.admin_action_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE TABLE public.admins (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name         text                     NOT NULL,
  email        text                     NOT NULL,
  auth_user_id uuid,
  role         text                     DEFAULT 'admin'::text NOT NULL,
  status       text                     DEFAULT 'active'::text NOT NULL,
  created_at   timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admins
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admins
  ADD CONSTRAINT admins_auth_user_id_key UNIQUE (auth_user_id);

ALTER TABLE public.admins
  ADD CONSTRAINT admins_email_key UNIQUE (email);

ALTER TABLE public.admins
  ADD CONSTRAINT admins_pkey PRIMARY KEY (id);

GRANT ALL ON public.admins TO anon;

GRANT ALL ON public.admins TO authenticated;

GRANT ALL ON public.admins TO service_role;

CREATE POLICY "Admins can read own admin profile" ON public.admins
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = auth_user_id));

CREATE POLICY "active admins can manage admins" ON public.admins
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "active admins can read all admins" ON public.admins
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can read own admin profile" ON public.admins
  FOR SELECT
  TO authenticated
  USING (((auth_user_id = auth.uid()) AND (status = 'active'::text)));

CREATE TABLE public.class_students (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  class_id   uuid                     NOT NULL,
  student_id uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.class_students
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_class_id_student_id_key UNIQUE (class_id, student_id);

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_pkey PRIMARY KEY (id);

GRANT ALL ON public.class_students TO anon;

GRANT ALL ON public.class_students TO authenticated;

GRANT ALL ON public.class_students TO service_role;

CREATE POLICY "Admins can read all class students" ON public.class_students
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage class student relations" ON public.class_students
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read classmate relations in own classes" ON public.class_students
  FOR SELECT
  TO authenticated
  USING (public.is_student_of_class(class_id));

CREATE POLICY "students can read own class student relations" ON public.class_students
  FOR SELECT
  TO authenticated
  USING (public.is_current_student(student_id));

CREATE POLICY "teachers can read class student relations for own classes" ON public.class_students
  FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_class(class_id));

CREATE TABLE public.class_teachers (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  class_id   uuid                     NOT NULL,
  teacher_id uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.class_teachers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_class_id_teacher_id_key UNIQUE (class_id, teacher_id);

ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_pkey PRIMARY KEY (id);

GRANT ALL ON public.class_teachers TO anon;

GRANT ALL ON public.class_teachers TO authenticated;

GRANT ALL ON public.class_teachers TO service_role;

CREATE POLICY "Admins can read all class teachers" ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage class teacher relations" ON public.class_teachers
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read teacher relations for own classes" ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (public.is_student_of_class(class_id));

CREATE POLICY "teachers can read own class teacher relations" ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (public.is_current_teacher(teacher_id));

CREATE TABLE public.classes (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  cohort_id       uuid,
  name            text                     NOT NULL,
  school          text,
  status          text                     DEFAULT 'active'::text NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  class_code      text,
  normalized_name text,
  subject         text
);

ALTER TABLE public.classes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);

ALTER TABLE public.classes
  ADD CONSTRAINT classes_cohort_id_name_key UNIQUE (cohort_id, name);

ALTER TABLE public.classes
  ADD CONSTRAINT classes_pkey PRIMARY KEY (id);

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_subject_check CHECK (subject IS NULL OR (subject = ANY (ARRAY['english'::text, 'math'::text])));

GRANT ALL ON public.classes TO anon;

GRANT ALL ON public.classes TO authenticated;

GRANT ALL ON public.classes TO service_role;

CREATE INDEX classes_subject_idx ON public.classes (subject);

CREATE UNIQUE INDEX classes_cohort_normalized_name_unique ON public.classes (cohort_id, normalized_name);

CREATE POLICY "Admins can read all classes" ON public.classes
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage classes" ON public.classes
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read own classes" ON public.classes
  FOR SELECT
  TO authenticated
  USING (public.is_student_of_class(id));

CREATE POLICY "teachers can read own classes" ON public.classes
  FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_class(id));

CREATE TABLE public.cohorts (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name            text                     NOT NULL,
  status          text                     DEFAULT 'active'::text NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  normalized_name text
);

ALTER TABLE public.cohorts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cohorts
  ADD CONSTRAINT cohorts_name_key UNIQUE (name);

ALTER TABLE public.cohorts
  ADD CONSTRAINT cohorts_pkey PRIMARY KEY (id);

ALTER TABLE public.classes
  ADD CONSTRAINT classes_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE SET NULL;

GRANT ALL ON public.cohorts TO anon;

GRANT ALL ON public.cohorts TO authenticated;

GRANT ALL ON public.cohorts TO service_role;

CREATE UNIQUE INDEX cohorts_normalized_name_unique ON public.cohorts (normalized_name);

CREATE POLICY "Admins can read all cohorts" ON public.cohorts
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage cohorts" ON public.cohorts
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE TABLE public.lesson_attendance (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  lesson_record_id uuid                     NOT NULL,
  student_id       uuid                     NOT NULL,
  is_present       boolean                  DEFAULT false NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.lesson_attendance
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lesson_attendance
  ADD CONSTRAINT lesson_attendance_pkey PRIMARY KEY (id);

ALTER TABLE public.lesson_attendance
  ADD CONSTRAINT lesson_attendance_unique_lesson_student UNIQUE (lesson_record_id, student_id);

GRANT ALL ON public.lesson_attendance TO anon;

GRANT ALL ON public.lesson_attendance TO authenticated;

GRANT ALL ON public.lesson_attendance TO service_role;

CREATE POLICY "Admins can read all lesson attendance" ON public.lesson_attendance
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage lesson attendance" ON public.lesson_attendance
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read own attendance" ON public.lesson_attendance
  FOR SELECT
  TO authenticated
  USING (((student_id IS NOT NULL) AND public.is_current_student(student_id)));

CREATE POLICY "teachers can create attendance for own lessons" ON public.lesson_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK ((public.can_teacher_manage_lesson(lesson_record_id) AND (student_id IS NOT NULL) AND public.is_student_in_lesson_class(lesson_record_id, student_id)));

CREATE POLICY "teachers can delete attendance for own lessons" ON public.lesson_attendance
  FOR DELETE
  TO authenticated
  USING (public.can_teacher_manage_lesson(lesson_record_id));

CREATE POLICY "teachers can read attendance for own classes" ON public.lesson_attendance
  FOR SELECT
  TO authenticated
  USING (public.can_teacher_read_lesson(lesson_record_id));

CREATE POLICY "teachers can update attendance for own lessons" ON public.lesson_attendance
  FOR UPDATE
  TO authenticated
  USING (public.can_teacher_manage_lesson(lesson_record_id))
  WITH CHECK ((public.can_teacher_manage_lesson(lesson_record_id) AND (student_id IS NOT NULL) AND public.is_student_in_lesson_class(lesson_record_id, student_id)));

CREATE TABLE public.lesson_records (
  id                          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  teacher_id                  uuid,
  class_id                    uuid,
  goal_id                     uuid,
  lesson_date                 date                     NOT NULL,
  duration_minutes            integer                  NOT NULL,
  lesson_title                text                     NOT NULL,
  lesson_content_and_feedback text                     NOT NULL,
  homework                    text,
  next_plan                   text,
  material_link               text,
  teacher_reflection          text,
  created_at                  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at                  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.lesson_records
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lesson_records
  ADD CONSTRAINT lesson_records_pkey PRIMARY KEY (id);

ALTER TABLE public.lesson_attendance
  ADD CONSTRAINT lesson_attendance_lesson_record_id_fkey FOREIGN KEY (lesson_record_id) REFERENCES public.lesson_records(id) ON DELETE CASCADE;

GRANT ALL ON public.lesson_records TO anon;

GRANT ALL ON public.lesson_records TO authenticated;

GRANT ALL ON public.lesson_records TO service_role;

CREATE POLICY "Admins can read all lesson records" ON public.lesson_records
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage lesson records" ON public.lesson_records
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read records for own classes" ON public.lesson_records
  FOR SELECT
  TO authenticated
  USING (public.is_student_of_class(class_id));

CREATE POLICY "teachers can create records for own classes" ON public.lesson_records
  FOR INSERT
  TO authenticated
  WITH CHECK ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id) AND ((goal_id IS NULL) OR public.is_goal_in_class(goal_id, class_id))));

CREATE POLICY "teachers can delete own records for own classes" ON public.lesson_records
  FOR DELETE
  TO authenticated
  USING ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)));

CREATE POLICY "teachers can read records for own classes" ON public.lesson_records
  FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_class(class_id));

CREATE POLICY "teachers can update own records for own classes" ON public.lesson_records
  FOR UPDATE
  TO authenticated
  USING ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)))
  WITH CHECK ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id) AND ((goal_id IS NULL) OR public.is_goal_in_class(goal_id, class_id))));

CREATE TABLE public.parent_messages (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  student_id   uuid,
  student_name text,
  parent_name  text,
  class_id     uuid,
  message      text                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.parent_messages
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.parent_messages
  ADD CONSTRAINT parent_messages_pkey PRIMARY KEY (id);

GRANT ALL ON public.parent_messages TO anon;

GRANT ALL ON public.parent_messages TO authenticated;

GRANT ALL ON public.parent_messages TO service_role;

CREATE POLICY "admins can manage parent messages" ON public.parent_messages
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can create own parent messages" ON public.parent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (((student_id IS NOT NULL) AND public.is_current_student(student_id)));

CREATE POLICY "students can delete own parent messages" ON public.parent_messages
  FOR DELETE
  TO authenticated
  USING (((student_id IS NOT NULL) AND public.is_current_student(student_id)));

CREATE POLICY "students can read own parent messages" ON public.parent_messages
  FOR SELECT
  TO authenticated
  USING (((student_id IS NOT NULL) AND public.is_current_student(student_id)));

CREATE POLICY "students can update own parent messages" ON public.parent_messages
  FOR UPDATE
  TO authenticated
  USING (((student_id IS NOT NULL) AND public.is_current_student(student_id)))
  WITH CHECK (((student_id IS NOT NULL) AND public.is_current_student(student_id)));

CREATE POLICY "teachers can read parent messages for own classes" ON public.parent_messages
  FOR SELECT
  TO authenticated
  USING (((student_id IS NOT NULL) AND public.can_teacher_read_student(student_id)));

CREATE TABLE public.student_lesson_comments (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  lesson_record_id uuid                     NOT NULL,
  student_id       uuid,
  student_name     text,
  comment          text                     NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.student_lesson_comments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_lesson_comments
  ADD CONSTRAINT student_lesson_comments_lesson_record_id_fkey FOREIGN KEY (lesson_record_id) REFERENCES public.lesson_records(id) ON DELETE CASCADE;

ALTER TABLE public.student_lesson_comments
  ADD CONSTRAINT student_lesson_comments_pkey PRIMARY KEY (id);

GRANT ALL ON public.student_lesson_comments TO anon;

GRANT ALL ON public.student_lesson_comments TO authenticated;

GRANT ALL ON public.student_lesson_comments TO service_role;

CREATE POLICY "Admins can read all student lesson comments" ON public.student_lesson_comments
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage student lesson comments" ON public.student_lesson_comments
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can create comments for own lessons" ON public.student_lesson_comments
  FOR INSERT
  TO authenticated
  WITH CHECK ((public.is_current_student(student_id) AND public.is_student_in_lesson_class(lesson_record_id, student_id)));

CREATE POLICY "students can delete own comments" ON public.student_lesson_comments
  FOR DELETE
  TO authenticated
  USING (public.is_current_student(student_id));

CREATE POLICY "students can read own comments" ON public.student_lesson_comments
  FOR SELECT
  TO authenticated
  USING (public.is_current_student(student_id));

CREATE POLICY "students can update own comments" ON public.student_lesson_comments
  FOR UPDATE
  TO authenticated
  USING (public.is_current_student(student_id))
  WITH CHECK ((public.is_current_student(student_id) AND public.is_student_in_lesson_class(lesson_record_id, student_id)));

CREATE POLICY "teachers can read comments for own classes" ON public.student_lesson_comments
  FOR SELECT
  TO authenticated
  USING (public.can_teacher_read_lesson(lesson_record_id));

CREATE TABLE public.students (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name                 text                     NOT NULL,
  note                 text,
  status               text                     DEFAULT 'active'::text NOT NULL,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  import_key           text,
  student_code         text,
  pin_code             text,
  auth_user_id         uuid,
  username             text,
  grade                text,
  must_change_password boolean                  DEFAULT true
);

CREATE POLICY "students can read own cohorts" ON public.cohorts
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ((public.classes c
     JOIN public.class_students cs ON ((cs.class_id = c.id)))
     JOIN public.students s ON ((s.id = cs.student_id)))
  WHERE ((c.cohort_id = cohorts.id) AND (s.auth_user_id = auth.uid()) AND (s.status = 'active'::text)))));

ALTER TABLE public.students
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.students
  ADD CONSTRAINT students_auth_user_id_key UNIQUE (auth_user_id);

ALTER TABLE public.students
  ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.lesson_attendance
  ADD CONSTRAINT lesson_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.students
  ADD CONSTRAINT students_username_key UNIQUE (username);

GRANT ALL ON public.students TO anon;

GRANT ALL ON public.students TO authenticated;

GRANT ALL ON public.students TO service_role;

CREATE UNIQUE INDEX students_import_key_unique ON public.students (import_key);

CREATE UNIQUE INDEX students_username_unique ON public.students (username)
  WHERE username IS NOT NULL;

CREATE POLICY "Admins can read all students" ON public.students
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "Students can read own student profile" ON public.students
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = auth_user_id));

CREATE POLICY "active admins can manage students" ON public.students
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read classmates" ON public.students
  FOR SELECT
  TO authenticated
  USING (public.can_student_read_student(id));

CREATE POLICY "students can read own profile" ON public.students
  FOR SELECT
  TO authenticated
  USING (((auth_user_id = auth.uid()) AND (status = 'active'::text)));

CREATE POLICY "teachers can read students in own classes" ON public.students
  FOR SELECT
  TO authenticated
  USING (public.can_teacher_read_student(id));

CREATE TABLE public.teachers (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name                 text                     NOT NULL,
  email                text,
  status               text                     DEFAULT 'active'::text NOT NULL,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  auth_user_id         uuid,
  display_name         text,
  school_entering_year integer,
  must_change_password boolean,
  subject              text
);

CREATE POLICY "teachers can read own cohorts" ON public.cohorts
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ((public.classes c
     JOIN public.class_teachers ct ON ((ct.class_id = c.id)))
     JOIN public.teachers t ON ((t.id = ct.teacher_id)))
  WHERE ((c.cohort_id = cohorts.id) AND (t.auth_user_id = auth.uid()) AND (t.status = 'active'::text)))));

ALTER TABLE public.teachers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_auth_user_id_key UNIQUE (auth_user_id);

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_name_key UNIQUE (name);

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);

ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_subject_check CHECK (subject IS NULL OR (subject = ANY (ARRAY['english'::text, 'math'::text])));

GRANT ALL ON public.teachers TO anon;

GRANT ALL ON public.teachers TO authenticated;

GRANT ALL ON public.teachers TO service_role;

CREATE UNIQUE INDEX teachers_email_unique ON public.teachers (email)
  WHERE email IS NOT NULL;

CREATE INDEX teachers_subject_idx ON public.teachers (subject);

CREATE POLICY "Admins can read all teachers" ON public.teachers
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "Teachers can read own teacher profile" ON public.teachers
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = auth_user_id));

CREATE POLICY "active admins can manage teachers" ON public.teachers
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read teachers in own classes" ON public.teachers
  FOR SELECT
  TO authenticated
  USING (public.can_student_read_teacher(id));

CREATE POLICY "teachers can read own profile" ON public.teachers
  FOR SELECT
  TO authenticated
  USING (((auth_user_id = auth.uid()) AND (status = 'active'::text)));

CREATE TABLE public.teaching_goals (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  teacher_id       uuid                     NOT NULL,
  class_id         uuid,
  title            text                     NOT NULL,
  description      text,
  start_date       date,
  end_date         date,
  status           text                     DEFAULT 'active'::text NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  expected_lessons integer,
  completed_at     timestamp with time zone
);

ALTER TABLE public.teaching_goals
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teaching_goals
  ADD CONSTRAINT teaching_goals_pkey PRIMARY KEY (id);

GRANT ALL ON public.teaching_goals TO anon;

GRANT ALL ON public.teaching_goals TO authenticated;

GRANT ALL ON public.teaching_goals TO service_role;

CREATE POLICY "Admins can read all teaching goals" ON public.teaching_goals
  FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

CREATE POLICY "admins can manage teaching goals" ON public.teaching_goals
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

CREATE POLICY "students can read goals for own classes" ON public.teaching_goals
  FOR SELECT
  TO authenticated
  USING (public.is_student_of_class(class_id));

CREATE POLICY "teachers can create goals for own classes" ON public.teaching_goals
  FOR INSERT
  TO authenticated
  WITH CHECK ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)));

CREATE POLICY "teachers can delete own goals for own classes" ON public.teaching_goals
  FOR DELETE
  TO authenticated
  USING ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)));

CREATE POLICY "teachers can read goals for own classes" ON public.teaching_goals
  FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_class(class_id));

CREATE POLICY "teachers can update own goals for own classes" ON public.teaching_goals
  FOR UPDATE
  TO authenticated
  USING ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)))
  WITH CHECK ((public.is_current_teacher(teacher_id) AND public.is_teacher_of_class(class_id)));

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
