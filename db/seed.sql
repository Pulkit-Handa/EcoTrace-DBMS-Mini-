-- ===========================================================================
-- EcoTrace — sample relational data
-- Demo password for every seeded user: password123
-- bcrypt hash generated with bcryptjs (cost 10).
-- ===========================================================================

TRUNCATE TABLE vendor_reports, carbon_credits, emission_records, users, departments
RESTART IDENTITY CASCADE;

INSERT INTO departments (name, emission_cap) VALUES
    ('Engineering', 5000.00),
    ('Operations', 3000.00),
    ('Logistics', 4000.00);

-- Alice is a global auditor; Bob and Carol lead Operations and Logistics.
INSERT INTO users (name, email, password_hash, role, dept_id) VALUES
    ('Alice Chen', 'alice@eco.com',
     '$2b$10$XVk54QKZRNfnDVUfUqwtcuSqWFodoDs3QSYbFUvlbfqJoQC3PCCrW',
     'auditor', 1),
    ('Bob Patel', 'bob@eco.com',
     '$2b$10$XVk54QKZRNfnDVUfUqwtcuSqWFodoDs3QSYbFUvlbfqJoQC3PCCrW',
     'dept_lead', 2),
    ('Carol Nair', 'carol@eco.com',
     '$2b$10$XVk54QKZRNfnDVUfUqwtcuSqWFodoDs3QSYbFUvlbfqJoQC3PCCrW',
     'dept_lead', 3);

-- Year-to-date 2026 activity. Engineering is under cap; Operations and
-- Logistics intentionally exceed their caps so every demo status is visible.
INSERT INTO emission_records
    (dept_id, user_id, scope, value_kgco2, recorded_at, description)
VALUES
    (1, 1, 1, 1200.00, NOW() - INTERVAL '82 days', 'Diesel generator usage'),
    (1, 1, 2,  800.00, NOW() - INTERVAL '61 days', 'Office electricity'),
    (1, 1, 3,  600.00, NOW() - INTERVAL '27 days', 'Cloud provider emissions'),
    (2, 2, 1,  450.00, NOW() - INTERVAL '74 days', 'Backup generator fuel'),
    (2, 2, 2,  380.00, NOW() - INTERVAL '52 days', 'Warehouse electricity'),
    (2, 2, 3, 3200.00, NOW() - INTERVAL '19 days', 'Supplier logistics'),
    (3, 3, 1,  500.00, NOW() - INTERVAL '66 days', 'Fleet diesel'),
    (3, 3, 2,  200.00, NOW() - INTERVAL '38 days', 'Cold storage power'),
    (3, 3, 3, 3900.00, NOW() - INTERVAL '8 days',  'Third-party freight');

INSERT INTO carbon_credits (dept_id, quantity, price_per_unit, txn_type) VALUES
    (1, 100.00, 12.50, 'buy'),
    (2,  40.00, 13.75, 'buy'),
    (3,  25.00, 11.20, 'offset'),
    (1,  10.00, 12.80, 'sell');
