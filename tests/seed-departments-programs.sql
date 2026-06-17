-- Insert test departments and programs
INSERT INTO departments (name, code, description, is_active, created_at, updated_at) VALUES
('College of Engineering', 'COE', 'College of Engineering and Technology', 1, NOW(), NOW()),
('College of Arts and Sciences', 'CAS', 'College of Liberal Arts and Sciences', 1, NOW(), NOW()),
('College of Business', 'COB', 'College of Business Administration', 1, NOW(), NOW()),
('College of Education', 'COEd', 'College of Education and Human Development', 1, NOW(), NOW());

-- Get department IDs for inserting programs
SET @coe_id = (SELECT department_id FROM departments WHERE code = 'COE' LIMIT 1);
SET @cas_id = (SELECT department_id FROM departments WHERE code = 'CAS' LIMIT 1);
SET @cob_id = (SELECT department_id FROM departments WHERE code = 'COB' LIMIT 1);
SET @coed_id = (SELECT department_id FROM departments WHERE code = 'COEd' LIMIT 1);

-- Insert test programs
INSERT INTO programs (name, code, description, department_id, is_active, created_at, updated_at) VALUES
-- COE Programs
('Computer Science', 'CS', 'Bachelor of Science in Computer Science', @coe_id, 1, NOW(), NOW()),
('Information Technology', 'IT', 'Bachelor of Science in Information Technology', @coe_id, 1, NOW(), NOW()),
('Civil Engineering', 'CE', 'Bachelor of Science in Civil Engineering', @coe_id, 1, NOW(), NOW()),
('Electrical Engineering', 'EE', 'Bachelor of Science in Electrical Engineering', @coe_id, 1, NOW(), NOW()),

-- CAS Programs
('Psychology', 'PSYC', 'Bachelor of Arts in Psychology', @cas_id, 1, NOW(), NOW()),
('English Literature', 'ENGL', 'Bachelor of Arts in English Literature', @cas_id, 1, NOW(), NOW()),
('Mathematics', 'MATH', 'Bachelor of Science in Mathematics', @cas_id, 1, NOW(), NOW()),
('Biology', 'BIO', 'Bachelor of Science in Biology', @cas_id, 1, NOW(), NOW()),

-- COB Programs
('Business Administration', 'BA', 'Bachelor of Science in Business Administration', @cob_id, 1, NOW(), NOW()),
('Accounting', 'ACCT', 'Bachelor of Science in Accounting', @cob_id, 1, NOW(), NOW()),
('Marketing', 'MKT', 'Bachelor of Science in Marketing', @cob_id, 1, NOW(), NOW()),
('Finance', 'FIN', 'Bachelor of Science in Finance', @cob_id, 1, NOW(), NOW()),

-- COEd Programs
('Elementary Education', 'ELED', 'Bachelor of Elementary Education', @coed_id, 1, NOW(), NOW()),
('Secondary Education', 'SCED', 'Bachelor of Secondary Education', @coed_id, 1, NOW(), NOW()),
('Special Education', 'SPED', 'Bachelor of Special Education', @coed_id, 1, NOW(), NOW());
