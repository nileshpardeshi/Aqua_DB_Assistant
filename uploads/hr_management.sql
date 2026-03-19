-- ============================================================
-- HR Management System Schema (PostgreSQL)
-- Tables: departments, employees, salaries, leave_requests
-- ============================================================

BEGIN;

-- ── Departments ──
CREATE TABLE departments (
    dept_id       SERIAL PRIMARY KEY,
    dept_name     VARCHAR(100) NOT NULL UNIQUE,
    dept_code     VARCHAR(10) NOT NULL UNIQUE,
    location      VARCHAR(150),
    budget        NUMERIC(15,2) DEFAULT 0,
    head_id       INTEGER,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Employees ──
CREATE TABLE employees (
    emp_id          SERIAL PRIMARY KEY,
    employee_code   VARCHAR(20) NOT NULL UNIQUE,
    first_name      VARCHAR(60) NOT NULL,
    last_name       VARCHAR(60) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20),
    hire_date       DATE NOT NULL,
    birth_date      DATE,
    gender          CHAR(1) CHECK (gender IN ('M', 'F', 'O')),
    dept_id         INTEGER NOT NULL REFERENCES departments(dept_id),
    manager_id      INTEGER REFERENCES employees(emp_id),
    job_title       VARCHAR(100) NOT NULL,
    employment_type VARCHAR(20) DEFAULT 'full-time'
                      CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern')),
    is_active       BOOLEAN DEFAULT TRUE,
    address         JSONB,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add FK for department head after employees table exists
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head
    FOREIGN KEY (head_id) REFERENCES employees(emp_id) ON DELETE SET NULL;

CREATE INDEX idx_employees_dept ON employees (dept_id);
CREATE INDEX idx_employees_manager ON employees (manager_id);
CREATE INDEX idx_employees_hire_date ON employees (hire_date);
CREATE INDEX idx_employees_code ON employees (employee_code);

-- ── Salary History ──
CREATE TABLE salaries (
    salary_id     BIGSERIAL PRIMARY KEY,
    emp_id        INTEGER NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
    base_salary   NUMERIC(12,2) NOT NULL CHECK (base_salary > 0),
    bonus         NUMERIC(10,2) DEFAULT 0,
    currency      CHAR(3) DEFAULT 'USD',
    effective_from DATE NOT NULL,
    effective_to   DATE,
    is_current    BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_salary_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_salaries_emp ON salaries (emp_id);
CREATE INDEX idx_salaries_current ON salaries (is_current) WHERE is_current = TRUE;

-- ── Leave Requests ──
CREATE TABLE leave_requests (
    leave_id      BIGSERIAL PRIMARY KEY,
    emp_id        INTEGER NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
    leave_type    VARCHAR(30) NOT NULL
                    CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'bereavement')),
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    total_days    NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
    status        VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by   INTEGER REFERENCES employees(emp_id),
    reason        TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_emp ON leave_requests (emp_id);
CREATE INDEX idx_leave_status ON leave_requests (status);
CREATE INDEX idx_leave_dates ON leave_requests (start_date, end_date);

-- ── Views ──
CREATE OR REPLACE VIEW v_employee_directory AS
SELECT
    e.emp_id,
    e.employee_code,
    e.first_name || ' ' || e.last_name AS full_name,
    e.email,
    e.job_title,
    d.dept_name,
    d.location,
    m.first_name || ' ' || m.last_name AS manager_name,
    s.base_salary,
    s.currency,
    e.hire_date,
    e.is_active
FROM employees e
JOIN departments d ON d.dept_id = e.dept_id
LEFT JOIN employees m ON m.emp_id = e.manager_id
LEFT JOIN salaries s ON s.emp_id = e.emp_id AND s.is_current = TRUE;

-- ── Seed Data ──
INSERT INTO departments (dept_name, dept_code, location, budget) VALUES
    ('Engineering',    'ENG',  'Building A, Floor 3', 2500000.00),
    ('Human Resources','HR',   'Building B, Floor 1',  800000.00),
    ('Marketing',      'MKT',  'Building A, Floor 2', 1200000.00),
    ('Finance',        'FIN',  'Building C, Floor 4', 1000000.00),
    ('Operations',     'OPS',  'Building D, Floor 1', 1500000.00);

INSERT INTO employees (employee_code, first_name, last_name, email, hire_date, dept_id, job_title, gender) VALUES
    ('EMP001', 'Rajesh',   'Kumar',    'rajesh.kumar@company.com',    '2020-01-15', 1, 'Engineering Manager',   'M'),
    ('EMP002', 'Priya',    'Sharma',   'priya.sharma@company.com',    '2020-03-10', 2, 'HR Director',           'F'),
    ('EMP003', 'Amit',     'Patel',    'amit.patel@company.com',      '2021-06-01', 1, 'Senior Developer',      'M'),
    ('EMP004', 'Sneha',    'Reddy',    'sneha.reddy@company.com',     '2021-09-15', 3, 'Marketing Lead',        'F'),
    ('EMP005', 'Vikram',   'Singh',    'vikram.singh@company.com',    '2022-01-10', 1, 'Backend Developer',     'M'),
    ('EMP006', 'Ananya',   'Gupta',    'ananya.gupta@company.com',    '2022-04-20', 4, 'Financial Analyst',     'F'),
    ('EMP007', 'Karthik',  'Nair',     'karthik.nair@company.com',    '2022-07-01', 1, 'Frontend Developer',    'M'),
    ('EMP008', 'Divya',    'Menon',    'divya.menon@company.com',     '2023-02-14', 5, 'Operations Analyst',    'F'),
    ('EMP009', 'Rahul',    'Joshi',    'rahul.joshi@company.com',     '2023-05-01', 2, 'HR Specialist',         'M'),
    ('EMP010', 'Meera',    'Iyer',     'meera.iyer@company.com',      '2023-08-20', 3, 'Content Strategist',    'F');

-- Set managers
UPDATE employees SET manager_id = 1 WHERE emp_id IN (3, 5, 7);
UPDATE employees SET manager_id = 2 WHERE emp_id IN (9);
UPDATE employees SET manager_id = 4 WHERE emp_id IN (10);

-- Set department heads
UPDATE departments SET head_id = 1 WHERE dept_id = 1;
UPDATE departments SET head_id = 2 WHERE dept_id = 2;
UPDATE departments SET head_id = 4 WHERE dept_id = 3;
UPDATE departments SET head_id = 6 WHERE dept_id = 4;
UPDATE departments SET head_id = 8 WHERE dept_id = 5;

INSERT INTO salaries (emp_id, base_salary, bonus, effective_from, is_current) VALUES
    (1, 120000.00, 15000.00, '2020-01-15', TRUE),
    (2, 110000.00, 12000.00, '2020-03-10', TRUE),
    (3,  95000.00,  8000.00, '2021-06-01', TRUE),
    (4,  88000.00, 10000.00, '2021-09-15', TRUE),
    (5,  82000.00,  5000.00, '2022-01-10', TRUE),
    (6,  78000.00,  6000.00, '2022-04-20', TRUE),
    (7,  80000.00,  5000.00, '2022-07-01', TRUE),
    (8,  72000.00,  4000.00, '2023-02-14', TRUE),
    (9,  68000.00,  3000.00, '2023-05-01', TRUE),
    (10, 65000.00,  3500.00, '2023-08-20', TRUE);

INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, total_days, status, approved_by, reason) VALUES
    (3, 'annual',  '2024-12-23', '2024-12-31', 7, 'approved', 1, 'Year-end vacation'),
    (5, 'sick',    '2025-01-06', '2025-01-08', 3, 'approved', 1, 'Flu recovery'),
    (7, 'annual',  '2025-02-14', '2025-02-14', 1, 'approved', 1, 'Personal day'),
    (9, 'annual',  '2025-03-10', '2025-03-14', 5, 'pending',  NULL, 'Family trip'),
    (10,'sick',    '2025-01-20', '2025-01-21', 2, 'approved', 4, 'Doctor appointment');

COMMIT;
