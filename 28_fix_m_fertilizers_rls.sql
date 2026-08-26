-- ==============================================================================
-- m_fertilizers および m_pesticides の SELECT 権限・RLSポリシー修正SQL
-- ==============================================================================

-- 1. m_fertilizers (公的肥料マスター) の読み取りを全ユーザー（認証済・匿名問わず）に許可
ALTER TABLE m_fertilizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on m_fertilizers" ON m_fertilizers;
CREATE POLICY "Allow public read access on m_fertilizers"
    ON m_fertilizers
    FOR SELECT
    TO public
    USING (true);

-- 2. m_pesticides (公的農薬マスター) の読み取りを全ユーザーに許可
ALTER TABLE m_pesticides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on m_pesticides" ON m_pesticides;
CREATE POLICY "Allow public read access on m_pesticides"
    ON m_pesticides
    FOR SELECT
    TO public
    USING (true);

-- 3. m_pesticide_ingredients (農薬有効成分マスター) の読み取りを全ユーザーに許可
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'm_pesticide_ingredients') THEN
        ALTER TABLE m_pesticide_ingredients ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public read access on m_pesticide_ingredients" ON m_pesticide_ingredients;
        CREATE POLICY "Allow public read access on m_pesticide_ingredients"
            ON m_pesticide_ingredients
            FOR SELECT
            TO public
            USING (true);
    END IF;
END $$;
