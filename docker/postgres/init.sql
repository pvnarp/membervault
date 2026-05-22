-- Audit trigger function (shared by all tables)
-- Triggers are attached to tables in the Drizzle migration (0000_closed_stick.sql)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (id, table_name, record_id, action, new_values, timestamp)
    VALUES (gen_random_uuid(), TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (id, table_name, record_id, action, old_values, new_values, timestamp)
    VALUES (gen_random_uuid(), TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), NOW());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (id, table_name, record_id, action, old_values, timestamp)
    VALUES (gen_random_uuid(), TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), NOW());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;
