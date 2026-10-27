CREATE TABLE schools (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL
);
CREATE INDEX ix_users_school_id ON users(school_id);
CREATE INDEX ix_users_email ON users(email);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX ix_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE classes (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    grade VARCHAR(40) NOT NULL,
    room VARCHAR(80) NOT NULL DEFAULT '',
    teacher VARCHAR(120) NOT NULL DEFAULT '',
    accent VARCHAR(12) NOT NULL DEFAULT 'teal'
);
CREATE INDEX ix_classes_school_id ON classes(school_id);

CREATE TABLE students (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    roll_no VARCHAR(20) NOT NULL,
    CONSTRAINT uq_students_class_roll UNIQUE (class_id, roll_no)
);
CREATE INDEX ix_students_school_id ON students(school_id);
CREATE INDEX ix_students_class_id ON students(class_id);

CREATE TABLE attendance (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(12) NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
    CONSTRAINT uq_attendance_student_date UNIQUE (student_id, date)
);
CREATE INDEX ix_attendance_school_id ON attendance(school_id);
CREATE INDEX ix_attendance_student_id ON attendance(student_id);
CREATE INDEX ix_attendance_date ON attendance(date);
