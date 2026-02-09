-- 运行此脚本以修复 "Could not find column" 错误
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. 修复充电状态核心列 (本次报错原因)
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_state TEXT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_mode TEXT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_kwh FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_time FLOAT;

-- 2. 修复核心 JSONB 列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS raw_metrics JSONB;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS car_metrics JSONB;

-- 3. 修复车辆状态列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS car_awake BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS locked BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS valet BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS gear TEXT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS handbrake BOOLEAN;

-- 4. 修复温度列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS inside_temp FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS outside_temp FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS temp_battery FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS temp_motor FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS temp_ambient FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_temp FLOAT;

-- 5. 修复充电详情列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_limit_soc FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_limit_range FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_type TEXT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS charge_pilot BOOLEAN;

-- 6. 修复位置与 GPS 列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS gps_lock BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS gps_sats INT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS elevation FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS direction FLOAT;

-- 7. 修复 TPMS 列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS tpms_fl FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS tpms_fr FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS tpms_rl FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS tpms_rr FLOAT;

-- 8. 修复 12V 电池列
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS voltage_12v FLOAT;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS current_12v FLOAT;

-- 9. 刷新 Schema 缓存
NOTIFY pgrst, 'reload schema';