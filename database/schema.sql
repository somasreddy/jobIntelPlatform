-- database/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE verified_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    work_mode VARCHAR(50), -- Remote, Hybrid, On-site
    salary_min INTEGER,
    salary_max INTEGER,
    currency VARCHAR(10),
    experience_required INTEGER,
    description TEXT,
    requirements JSONB,
    technologies JSONB,
    application_link TEXT,
    career_page_link TEXT,
    recruiter_name VARCHAR(255),
    recruiter_linkedin TEXT,
    verification_status VARCHAR(50) DEFAULT 'UNVERIFIED',
    level_up BOOLEAN DEFAULT FALSE,
    match_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Assuming an external auth standard
    name VARCHAR(255) NOT NULL,
    current_role VARCHAR(255),
    experience_years INTEGER,
    current_location VARCHAR(255),
    skills JSONB,
    frameworks JSONB,
    cicd_tools JSONB,
    base_resume_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    job_id UUID REFERENCES verified_jobs(id),
    status VARCHAR(50) NOT NULL, -- Saved, Applied, Assessment, Interview, Offer, Rejected
    date_applied TIMESTAMP WITH TIME ZONE,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    generated_resume_url TEXT,
    generated_cover_letter_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_verified_jobs_status ON verified_jobs(verification_status);
CREATE INDEX idx_verified_jobs_created_at ON verified_jobs(created_at DESC);

-- Resume generation history
CREATE TABLE resume_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    job_id UUID REFERENCES verified_jobs(id) ON DELETE SET NULL,
    job_title VARCHAR(255),
    organization VARCHAR(255),
    ats_score INTEGER,
    summary TEXT,
    bullets JSONB,
    skills_grouped JSONB,
    pdf_base64 TEXT,
    docx_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resume_history_user_id ON resume_history(user_id);
CREATE INDEX idx_resume_history_created_at ON resume_history(created_at DESC);
