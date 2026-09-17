CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  receiver_name VARCHAR(100) NOT NULL,
  destination VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
 
-- allowed status values used by the app (enforced in code, not DB constraint):
-- pending, in_transit, out_for_delivery, delivered, cancelled
 