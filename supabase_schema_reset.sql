-- DESTRUCTIVE: Drop existing tables to completely reset the schema and clear all caching errors
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;

-- 1. Create the Patients table with hospital tracking and correct columns
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    hospital_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    patient_custom_id TEXT,
    patient_name TEXT NOT NULL,
    patient_number TEXT,
    age INT,
    gender TEXT,
    last_visit DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Healthy',
    UNIQUE (hospital_id, patient_number)
);

-- 2. Create the Reports table with detailed analysis storage
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    report_text TEXT, 
    analysis JSONB,   
    risk_level TEXT,
    status TEXT DEFAULT 'Uploaded'
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Patients
CREATE POLICY "Hospitals can see their own patients" 
ON public.patients FOR SELECT 
USING (auth.uid() = hospital_id);

CREATE POLICY "Hospitals can insert their own patients" 
ON public.patients FOR INSERT 
WITH CHECK (auth.uid() = hospital_id);

CREATE POLICY "Hospitals can update their own patients" 
ON public.patients FOR UPDATE 
USING (auth.uid() = hospital_id);

CREATE POLICY "Hospitals can delete their own patients"
ON public.patients FOR DELETE
USING (auth.uid() = hospital_id);

-- 5. Create RLS Policies for Reports
CREATE POLICY "Hospitals can see reports for their patients" 
ON public.reports FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.patients 
        WHERE public.patients.id = public.reports.patient_id 
        AND public.patients.hospital_id = auth.uid()
    )
);

CREATE POLICY "Hospitals can delete reports of their patients"
ON public.reports FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.patients 
        WHERE public.patients.id = public.reports.patient_id 
        AND public.patients.hospital_id = auth.uid()
    )
);
-- 6. Create RLS Policies for Public Shared Access
-- Allow anyone with a link to view report summaries
CREATE POLICY "Public can view individual reports by ID"
ON public.reports FOR SELECT
TO anon
USING (true);

-- Allow public to see patient name associated with report (needed for greeting on shared page)
CREATE POLICY "Public can view patient names associated with reports"
ON public.patients FOR SELECT
TO anon
USING (true);

-- 7. Force the PostgREST API to instantly reload the exact schema
NOTIFY pgrst, 'reload schema';
