-- MedInsight AI - Vitals Module Schema Additions
-- Run this in your Supabase SQL Editor to create the missing tables

-- 1. Vitals Sessions
CREATE TABLE IF NOT EXISTS public.vitals_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    device_label TEXT,
    condition_tag TEXT,
    summary JSONB,
    samples JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Patient Sessions
CREATE TABLE IF NOT EXISTS public.patient_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    patient_id TEXT,
    timestamp TEXT,
    heart_rate NUMERIC,
    respiration_rate NUMERIC,
    spo2 NUMERIC,
    hrv NUMERIC,
    stress_score NUMERIC,
    ai_risk_level TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Reference Readings
CREATE TABLE IF NOT EXISTS public.reference_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    device_name TEXT,
    condition_tag TEXT,
    readings JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Accuracy Metrics
CREATE TABLE IF NOT EXISTS public.accuracy_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    reference_id UUID REFERENCES public.reference_readings(id),
    hr_metrics JSONB,
    rr_metrics JSONB,
    spo2_metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add public access policies (allows the python backend to freely save data)
ALTER TABLE public.vitals_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accuracy_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access vitals_sessions" ON public.vitals_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access patient_sessions" ON public.patient_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access reference_readings" ON public.reference_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access accuracy_metrics" ON public.accuracy_metrics FOR ALL USING (true) WITH CHECK (true);

-- Reload PostgREST API cache
NOTIFY pgrst, 'reload schema';
