-- ==============================================================================
-- 29_secure_rls_multi_tenant.sql
-- SaaSマルチテナント完全分離・第2の防壁：Supabase RLS（行レベルセキュリティ）全面改修
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. 事前準備：全テーブルへの user_id カラム自動追加 ＆ 既存データの自動修復
-- ------------------------------------------------------------------------------
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'b2b_customers', 'b2b_orders', 'b2b_invoices', 'crops', 'fields', 
            'workers', 'materials', 'company_settings', 'work_logs', 'material_costs', 
            'sales_logs', 'monthly_expenses', 'sales_prices', 'sales_channels', 
            'cultivation_plans_v2', 'nursery_schedules_v2', 'field_soil_diagnoses', 
            'attendance_logs', 'leave_requests', 'board_posts', 'board_comments', 
            'video_manuals', 'video_narrations'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            -- user_id カラムを追加
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id UUID;', tbl);
            
            -- farm_id カラムが存在し user_id が NULL の場合は farm_id の値を user_id に自動移行
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'farm_id') THEN
                EXECUTE format('UPDATE public.%I SET user_id = farm_id WHERE user_id IS NULL;', tbl);
            END IF;
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 1. 極秘・経営管理テーブル（anon完全遮断 ＆ auth.uid() = user_id のみ許可）
-- ------------------------------------------------------------------------------

-- (1) B2B取引先 (b2b_customers)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_customers') THEN
    ALTER TABLE public.b2b_customers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for b2b_customers" ON public.b2b_customers;
    DROP POLICY IF EXISTS "Authenticated users manage own b2b_customers" ON public.b2b_customers;
    CREATE POLICY "Authenticated users manage own b2b_customers" ON public.b2b_customers
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (2) B2B受注 (b2b_orders)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_orders') THEN
    ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for b2b_orders" ON public.b2b_orders;
    DROP POLICY IF EXISTS "Authenticated users manage own b2b_orders" ON public.b2b_orders;
    CREATE POLICY "Authenticated users manage own b2b_orders" ON public.b2b_orders
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (3) B2B受注明細 (b2b_order_items)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_order_items') THEN
    ALTER TABLE public.b2b_order_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for b2b_order_items" ON public.b2b_order_items;
    DROP POLICY IF EXISTS "Authenticated users manage own b2b_order_items" ON public.b2b_order_items;
    CREATE POLICY "Authenticated users manage own b2b_order_items" ON public.b2b_order_items
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.b2b_orders o WHERE o.id = b2b_order_items.order_id AND o.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.b2b_orders o WHERE o.id = b2b_order_items.order_id AND o.user_id = auth.uid()));
  END IF;
END $$;

-- (4) B2B請求書 (b2b_invoices)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_invoices') THEN
    ALTER TABLE public.b2b_invoices ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for b2b_invoices" ON public.b2b_invoices;
    DROP POLICY IF EXISTS "Allow all operations for invoices" ON public.b2b_invoices;
    DROP POLICY IF EXISTS "Authenticated users manage own b2b_invoices" ON public.b2b_invoices;
    CREATE POLICY "Authenticated users manage own b2b_invoices" ON public.b2b_invoices
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (5) 出荷・売上ログ (sales_logs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_logs') THEN
    ALTER TABLE public.sales_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for sales_logs" ON public.sales_logs;
    DROP POLICY IF EXISTS "Authenticated users manage own sales_logs" ON public.sales_logs;
    CREATE POLICY "Authenticated users manage own sales_logs" ON public.sales_logs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (6) 資材経費 (material_costs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_costs') THEN
    ALTER TABLE public.material_costs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for material_costs" ON public.material_costs;
    DROP POLICY IF EXISTS "Authenticated users manage own material_costs" ON public.material_costs;
    CREATE POLICY "Authenticated users manage own material_costs" ON public.material_costs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (7) 月次経費 (monthly_expenses)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_expenses') THEN
    ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for monthly_expenses" ON public.monthly_expenses;
    DROP POLICY IF EXISTS "Authenticated users manage own monthly_expenses" ON public.monthly_expenses;
    CREATE POLICY "Authenticated users manage own monthly_expenses" ON public.monthly_expenses
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (8) 販売価格マスタ (sales_prices)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_prices') THEN
    ALTER TABLE public.sales_prices ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for sales_prices" ON public.sales_prices;
    DROP POLICY IF EXISTS "Authenticated users manage own sales_prices" ON public.sales_prices;
    CREATE POLICY "Authenticated users manage own sales_prices" ON public.sales_prices
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (9) 販路マスタ (sales_channels)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_channels') THEN
    ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all operations for sales_channels" ON public.sales_channels;
    DROP POLICY IF EXISTS "Authenticated users manage own sales_channels" ON public.sales_channels;
    CREATE POLICY "Authenticated users manage own sales_channels" ON public.sales_channels
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (10) 栽培計画 (cultivation_plans_v2)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cultivation_plans_v2') THEN
    ALTER TABLE public.cultivation_plans_v2 ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read cultivation_plans_v2" ON public.cultivation_plans_v2;
    DROP POLICY IF EXISTS "Allow anon insert cultivation_plans_v2" ON public.cultivation_plans_v2;
    DROP POLICY IF EXISTS "Allow anon update cultivation_plans_v2" ON public.cultivation_plans_v2;
    DROP POLICY IF EXISTS "Allow anon delete cultivation_plans_v2" ON public.cultivation_plans_v2;
    DROP POLICY IF EXISTS "Authenticated users manage own cultivation_plans" ON public.cultivation_plans_v2;
    CREATE POLICY "Authenticated users manage own cultivation_plans" ON public.cultivation_plans_v2
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- (11) 育苗スケジュール (nursery_schedules_v2)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nursery_schedules_v2') THEN
    ALTER TABLE public.nursery_schedules_v2 ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read nursery_schedules_v2" ON public.nursery_schedules_v2;
    DROP POLICY IF EXISTS "Allow anon insert nursery_schedules_v2" ON public.nursery_schedules_v2;
    DROP POLICY IF EXISTS "Allow anon update nursery_schedules_v2" ON public.nursery_schedules_v2;
    DROP POLICY IF EXISTS "Allow anon delete nursery_schedules_v2" ON public.nursery_schedules_v2;
    DROP POLICY IF EXISTS "Authenticated users manage own nursery_schedules" ON public.nursery_schedules_v2;
    CREATE POLICY "Authenticated users manage own nursery_schedules" ON public.nursery_schedules_v2
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.cultivation_plans_v2 cp WHERE cp.id = nursery_schedules_v2.plan_id AND cp.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.cultivation_plans_v2 cp WHERE cp.id = nursery_schedules_v2.plan_id AND cp.user_id = auth.uid()));
  END IF;
END $$;

-- (12) 土壌診断記録 (field_soil_diagnoses)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'field_soil_diagnoses') THEN
    ALTER TABLE public.field_soil_diagnoses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users manage own field_soil_diagnoses" ON public.field_soil_diagnoses;
    CREATE POLICY "Authenticated users manage own field_soil_diagnoses" ON public.field_soil_diagnoses
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. マスタテーブル（管理者は全権限 ＆ 現場作業員anonはSELECT閲覧のみ許可）
-- ------------------------------------------------------------------------------

-- (13) 作目マスタ (crops)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crops') THEN
    ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read crops" ON public.crops;
    DROP POLICY IF EXISTS "Authenticated users manage own crops" ON public.crops;
    DROP POLICY IF EXISTS "Anon read crops" ON public.crops;
    CREATE POLICY "Authenticated users manage own crops" ON public.crops
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read crops" ON public.crops
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- (14) 圃場マスタ (fields)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fields') THEN
    ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read fields" ON public.fields;
    DROP POLICY IF EXISTS "Authenticated users manage own fields" ON public.fields;
    DROP POLICY IF EXISTS "Anon read fields" ON public.fields;
    CREATE POLICY "Authenticated users manage own fields" ON public.fields
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read fields" ON public.fields
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- (15) 作業者マスタ (workers)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
    ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read workers" ON public.workers;
    DROP POLICY IF EXISTS "Allow anon update workers" ON public.workers;
    DROP POLICY IF EXISTS "Authenticated users manage own workers" ON public.workers;
    DROP POLICY IF EXISTS "Anon read and pin check workers" ON public.workers;
    CREATE POLICY "Authenticated users manage own workers" ON public.workers
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read and pin check workers" ON public.workers
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- (16) 資材・農薬・肥料マスタ (materials)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials') THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read materials" ON public.materials;
    DROP POLICY IF EXISTS "Authenticated users manage own materials" ON public.materials;
    DROP POLICY IF EXISTS "Anon read materials" ON public.materials;
    CREATE POLICY "Authenticated users manage own materials" ON public.materials
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read materials" ON public.materials
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- (17) 会社・農園設定 (company_settings)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_settings') THEN
    ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read company_settings" ON public.company_settings;
    DROP POLICY IF EXISTS "Authenticated users manage own company_settings" ON public.company_settings;
    DROP POLICY IF EXISTS "Anon read company_settings" ON public.company_settings;
    CREATE POLICY "Authenticated users manage own company_settings" ON public.company_settings
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read company_settings" ON public.company_settings
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. 現場・労務・ポータルテーブル（管理者は全権限 ＆ 現場作業員anonは日報・打刻操作を許可）
-- ------------------------------------------------------------------------------

-- (18) 作業日報・タスク (work_logs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_logs') THEN
    ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read work_logs" ON public.work_logs;
    DROP POLICY IF EXISTS "Allow anon insert work_logs" ON public.work_logs;
    DROP POLICY IF EXISTS "Allow anon update work_logs" ON public.work_logs;
    DROP POLICY IF EXISTS "Authenticated users manage own work_logs" ON public.work_logs;
    DROP POLICY IF EXISTS "Anon portal work_logs" ON public.work_logs;
    CREATE POLICY "Authenticated users manage own work_logs" ON public.work_logs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon portal work_logs" ON public.work_logs
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- (19) 出退勤打刻 (attendance_logs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs') THEN
    ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read attendance_logs" ON public.attendance_logs;
    DROP POLICY IF EXISTS "Allow anon insert attendance_logs" ON public.attendance_logs;
    DROP POLICY IF EXISTS "Allow anon update attendance_logs" ON public.attendance_logs;
    DROP POLICY IF EXISTS "Authenticated users manage own attendance_logs" ON public.attendance_logs;
    DROP POLICY IF EXISTS "Anon portal attendance_logs" ON public.attendance_logs;
    CREATE POLICY "Authenticated users manage own attendance_logs" ON public.attendance_logs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon portal attendance_logs" ON public.attendance_logs
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- (20) 休暇申請 (leave_requests)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read leave_requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Allow anon insert leave_requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Allow anon update leave_requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Authenticated users manage own leave_requests" ON public.leave_requests;
    DROP POLICY IF EXISTS "Anon portal leave_requests" ON public.leave_requests;
    CREATE POLICY "Authenticated users manage own leave_requests" ON public.leave_requests
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon portal leave_requests" ON public.leave_requests
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- (21) 掲示板投稿 (board_posts)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_posts') THEN
    ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read board_posts" ON public.board_posts;
    DROP POLICY IF EXISTS "Allow anon insert board_posts" ON public.board_posts;
    DROP POLICY IF EXISTS "Authenticated users manage own board_posts" ON public.board_posts;
    DROP POLICY IF EXISTS "Anon portal board_posts" ON public.board_posts;
    CREATE POLICY "Authenticated users manage own board_posts" ON public.board_posts
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon portal board_posts" ON public.board_posts
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- (22) 掲示板コメント (board_comments)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_comments') THEN
    ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anon read board_comments" ON public.board_comments;
    DROP POLICY IF EXISTS "Allow anon insert board_comments" ON public.board_comments;
    DROP POLICY IF EXISTS "Authenticated users manage own board_comments" ON public.board_comments;
    DROP POLICY IF EXISTS "Anon portal board_comments" ON public.board_comments;
    CREATE POLICY "Authenticated users manage own board_comments" ON public.board_comments
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon portal board_comments" ON public.board_comments
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- (23) 動画マニュアル (video_manuals)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_manuals') THEN
    ALTER TABLE public.video_manuals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users manage own video_manuals" ON public.video_manuals;
    DROP POLICY IF EXISTS "Anon read video_manuals" ON public.video_manuals;
    CREATE POLICY "Authenticated users manage own video_manuals" ON public.video_manuals
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read video_manuals" ON public.video_manuals
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- (24) 動画ナレーション (video_narrations)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_narrations') THEN
    ALTER TABLE public.video_narrations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated users manage own video_narrations" ON public.video_narrations;
    DROP POLICY IF EXISTS "Anon read video_narrations" ON public.video_narrations;
    CREATE POLICY "Authenticated users manage own video_narrations" ON public.video_narrations
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Anon read video_narrations" ON public.video_narrations
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
