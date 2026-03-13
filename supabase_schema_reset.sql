-- DESTRUCTIVE: Drop existing tables to completely reset the schema and clear all caching errors
DROP TABLE IF EXISTS public.accuracy_metrics CASCADE;
DROP TABLE IF EXISTS public.reference_readings CASCADE;
DROP TABLE IF EXISTS public.vitals_sessions CASCADE;
DROP TABLE IF EXISTS public.patient_sessions CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;

-- 1. Create the Patients table with hospital tracking and correct columns
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    hospital_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    patient_custom_id TEXT, -- User-defined ID (e.g., P.SAGAR4)
    patient_name TEXT NOT NULL,
    patient_number TEXT,
    age INT,
    gender TEXT,
    last_visit DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Healthy'
);

-- 2. Create the Reports table with detailed analysis storage
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    report_text TEXT, 
    analysis JSONB, -- Stores the JSON analysis (summary, translation, risk, etc.)
    risk_level TEXT,
    status TEXT DEFAULT 'Uploaded'
);

-- 3. Create vitals benchmark session table
CREATE TABLE public.vitals_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    device_label TEXT DEFAULT 'webcam-rppg',
    condition_tag TEXT DEFAULT 'general',
    summary JSONB DEFAULT '{}'::jsonb,
    samples JSONB DEFAULT '[]'::jsonb
);

-- 3b. Create patient session table for long-term daily trend monitoring
CREATE TABLE public.patient_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    session_id UUID REFERENCES public.vitals_sessions(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL DEFAULT 'anonymous',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    heart_rate NUMERIC(6,2),
    respiration_rate NUMERIC(6,2),
    spo2 NUMERIC(6,2),
    hrv NUMERIC(8,2),
    stress_score NUMERIC(6,2),
    ai_risk_level TEXT DEFAULT 'NORMAL'
);

CREATE INDEX idx_patient_sessions_patient_timestamp ON public.patient_sessions(patient_id, timestamp);

-- 4. Create reference readings table (judge smartwatch or manual)
CREATE TABLE public.reference_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    session_id UUID REFERENCES public.vitals_sessions(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    condition_tag TEXT DEFAULT 'general',
    readings JSONB DEFAULT '[]'::jsonb
);

-- 5. Create computed accuracy metrics table
CREATE TABLE public.accuracy_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    session_id UUID REFERENCES public.vitals_sessions(id) ON DELETE CASCADE,
    reference_id UUID REFERENCES public.reference_readings(id) ON DELETE CASCADE,
    hr_metrics JSONB DEFAULT '{}'::jsonb,
    rr_metrics JSONB DEFAULT '{}'::jsonb,
    spo2_metrics JSONB DEFAULT '{}'::jsonb
);


-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accuracy_metrics ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for Patients
CREATE POLICY "Hospitals can manage their own patients" 
ON public.patients FOR ALL 
USING (auth.uid() = hospital_id)
WITH CHECK (auth.uid() = hospital_id);

CREATE POLICY "Public can view patient names for shared reports"
ON public.patients FOR SELECT
TO anon
USING (true);


-- 8. Create RLS Policies for Reports
CREATE POLICY "Hospitals can manage reports for their patients" 
ON public.reports FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.patients 
        WHERE public.patients.id = public.reports.patient_id 
        AND public.patients.hospital_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.patients 
        WHERE public.patients.id = public.reports.patient_id 
        AND public.patients.hospital_id = auth.uid()
    )
);

-- 6. Create RLS Policies for Public Shared Access
CREATE POLICY "Public can view individual reports by link"
ON public.reports FOR SELECT
TO anon
USING (true);

-- 9. Create RLS policies for vitals benchmark tables
CREATE POLICY "Authenticated users can manage vitals sessions"
ON public.vitals_sessions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can access vitals sessions for demos"
ON public.vitals_sessions FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage patient sessions"
ON public.patient_sessions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can access patient sessions for demos"
ON public.patient_sessions FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage reference readings"
ON public.reference_readings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can access reference readings for demos"
ON public.reference_readings FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage accuracy metrics"
ON public.accuracy_metrics FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can access accuracy metrics for demos"
ON public.accuracy_metrics FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- 10. Force the PostgREST API to instantly reload the exact schema
NOTIFY pgrst, 'reload schema';
