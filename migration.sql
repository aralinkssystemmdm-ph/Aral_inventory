-- 1. Update equipment table
ALTER TABLE equipment RENAME COLUMN is_serialized TO is_serializable;
ALTER TABLE equipment DROP COLUMN IF EXISTS serial_number;

-- 2. Update bundle_items table
ALTER TABLE bundle_items RENAME COLUMN is_serialized TO is_serializable;
ALTER TABLE bundle_items DROP COLUMN IF EXISTS serial_number;

-- 3. Create item_serials table
CREATE TABLE IF NOT EXISTS item_serials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_code TEXT NOT NULL REFERENCES equipment(code),
  serial_number TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'Available',
  request_id TEXT, -- Link to item_requests.control_no
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_item_serials_item_code ON item_serials(item_code);
CREATE INDEX IF NOT EXISTS idx_item_serials_location ON item_serials(location);
