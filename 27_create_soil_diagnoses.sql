-- ==============================================================================
-- 27_create_soil_diagnoses.sql
-- 圃場土壌診断カルテ（soil_diagnoses）テーブル作成
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.soil_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                        -- テナントID (農園ID)
    field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE, -- 圃場ID
    diagnosis_date DATE NOT NULL,                 -- 診断・土壌採取年月日
    agency_name TEXT,                             -- 診断機関名 (JA、農業改良普及センター等)
    soil_type TEXT,                               -- 土性 (砂土, 砂壌土, 壌土, 植土, 黒ボク土等)
    
    -- 土壌基本物性
    ph NUMERIC(4, 2),                             -- 土壌酸度 pH(H2O) (基準値例: 6.0〜6.5)
    ec NUMERIC(5, 3),                             -- 電気伝導度 EC mS/cm (基準値例: 0.2〜0.6)
    cec NUMERIC(6, 2),                            -- 塩基置換容量 CEC meq/100g (基準値例: 15〜25)
    humus_percent NUMERIC(5, 2),                  -- 腐植含有率 % (基準値例: 3.0〜5.0)
    phosphate_absorption_coeff NUMERIC(7, 2),     -- りん酸吸収係数 mg/100g

    -- 養分・無機態窒素・塩基類 (mg/100g または mg/kg)
    inorganic_n_mg NUMERIC(6, 2),                 -- 無機態窒素 mg/100g
    available_p_mg NUMERIC(6, 2),                 -- 有効態りん酸 (トルオーグ法等) mg/100g (基準値例: 10〜30)
    exchangeable_k_mg NUMERIC(6, 2),              -- 置換性加里 (K2O) mg/100g (基準値例: 15〜30)
    exchangeable_ca_mg NUMERIC(6, 2),             -- 置換性石灰 (CaO) mg/100g (基準値例: 200〜350)
    exchangeable_mg_mg NUMERIC(6, 2),             -- 置換性苦土 (MgO) mg/100g (基準値例: 25〜60)

    -- 塩基バランス・飽和度比率
    base_saturation_percent NUMERIC(5, 2),        -- 塩基飽和度 % (基準値例: 60〜80%)
    ca_saturation_percent NUMERIC(5, 2),          -- 石灰飽和度 % (基準値例: 50〜65%)
    mg_saturation_percent NUMERIC(5, 2),          -- 苦土飽和度 % (基準値例: 10〜15%)
    k_saturation_percent NUMERIC(5, 2),           -- 加里飽和度 % (基準値例: 3〜5%)
    ca_mg_ratio NUMERIC(5, 2),                    -- 石灰苦土比 (CaO/MgO) (基準値例: 4.0〜6.0)
    mg_k_ratio NUMERIC(5, 2),                     -- 苦土加里比 (MgO/K2O) (基準値例: 2.0〜3.0)

    -- 診断所見・処方箋・メモ
    diagnosis_summary TEXT,                       -- 総合判定・診断所見
    improvement_recommendations TEXT,             -- 施肥・土壌改良処方箋
    report_file_url TEXT,                         -- 診断票PDF・写真添付URL

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_soil_diagnoses_user_id ON public.soil_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_soil_diagnoses_field_id ON public.soil_diagnoses(field_id);
CREATE INDEX IF NOT EXISTS idx_soil_diagnoses_date ON public.soil_diagnoses(diagnosis_date DESC);

-- RLS（行レベルセキュリティ）の設定
ALTER TABLE public.soil_diagnoses ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーの再作成
DROP POLICY IF EXISTS "soil_diagnoses_tenant_isolation_select" ON public.soil_diagnoses;
CREATE POLICY "soil_diagnoses_tenant_isolation_select" ON public.soil_diagnoses
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NOT NULL);

DROP POLICY IF EXISTS "soil_diagnoses_tenant_isolation_insert" ON public.soil_diagnoses;
CREATE POLICY "soil_diagnoses_tenant_isolation_insert" ON public.soil_diagnoses
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NOT NULL);

DROP POLICY IF EXISTS "soil_diagnoses_tenant_isolation_update" ON public.soil_diagnoses;
CREATE POLICY "soil_diagnoses_tenant_isolation_update" ON public.soil_diagnoses
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NOT NULL);

DROP POLICY IF EXISTS "soil_diagnoses_tenant_isolation_delete" ON public.soil_diagnoses;
CREATE POLICY "soil_diagnoses_tenant_isolation_delete" ON public.soil_diagnoses
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NOT NULL);
