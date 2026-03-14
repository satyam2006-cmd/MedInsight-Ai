-- Consistently Reset and Setup MedInsight AI Schema with Dual Account Support
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Patients Table
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
    status TEXT DEFAULT 'Healthy'
);

-- Reports Table
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

-- Profiles Table (Refined for Dual Accounts)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_type TEXT DEFAULT 'hospital', -- 'hospital' or 'user'
    hospital_name TEXT,
    full_name TEXT,
    admin_username TEXT,
    email TEXT,
    phone TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hospital Management Policies
CREATE POLICY "Hospitals can manage their own patients" ON public.patients FOR ALL USING (auth.uid() = hospital_id) WITH CHECK (auth.uid() = hospital_id);
CREATE POLICY "Hospitals can manage reports for their patients" ON public.reports FOR ALL USING (EXISTS (SELECT 1 FROM public.patients WHERE public.patients.id = public.reports.patient_id AND public.patients.hospital_id = auth.uid()));

-- Public Access Policies (Read-only for sharing)
CREATE POLICY "Public can view patient names for shared reports" ON public.patients FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view individual reports by link" ON public.reports FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view hospital profiles" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Users can update their own profiles" ON public.profiles FOR UPDATE USING (auth.uid() = id);

NOTIFY pgrst, 'reload schema';

-- Backfill existing users with metadata extraction
INSERT INTO public.profiles (id, account_type, hospital_name, full_name, admin_username, email, phone)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'account_type', 'hospital'),
    COALESCE(raw_user_meta_data->>'hospital_name', ''),
    COALESCE(raw_user_meta_data->>'full_name', ''),
    COALESCE(raw_user_meta_data->>'admin_username', 'admin'),
    email,
    (COALESCE(raw_user_meta_data->>'country_code', '') || ' ' || COALESCE(raw_user_meta_data->>'phone', ''))
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    account_type = EXCLUDED.account_type,
    hospital_name = EXCLUDED.hospital_name,
    full_name = EXCLUDED.full_name,
    admin_username = EXCLUDED.admin_username,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now();
