import { CandidateProfile, Job, GeneratedResume } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ── Generic fetch wrapper ──────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    // Return null to signal mock mode
    return null as T;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Job endpoints ──────────────────────────────────────────────────────────────
export async function fetchVerifiedJobs() {
  return apiFetch<Job[]>("/api/verified-jobs");
}

export async function fetchJobMatchScore(
  jobId: string,
  profile: CandidateProfile
) {
  return apiFetch<{ score: number; breakdown: Record<string, number> }>(
    "/api/job-match-score",
    { method: "POST", body: JSON.stringify({ jobId, profile }) }
  );
}

// ── Resume endpoints ───────────────────────────────────────────────────────────
export async function parseResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<Partial<CandidateProfile>>("/api/resume-parser", {
    method: "POST",
    body: form,
    headers: {},
  });
}

export async function generateATSResume(
  profile: CandidateProfile,
  jobDescription: string
) {
  return apiFetch<GeneratedResume>("/api/ats-resume", {
    method: "POST",
    body: JSON.stringify({ profile, jobDescription }),
  });
}

export async function generateCoverLetter(
  profile: CandidateProfile,
  jobDescription: string,
  jobTitle: string,
  organization: string
) {
  return apiFetch<{ content: string }>("/api/cover-letter", {
    method: "POST",
    body: JSON.stringify({ profile, jobDescription, jobTitle, organization }),
  });
}

export async function generateRecruiterMessage(
  profile: CandidateProfile,
  jobTitle: string,
  organization: string,
  recruiterName: string
) {
  return apiFetch<{ message: string }>("/api/recruiter-message", {
    method: "POST",
    body: JSON.stringify({ profile, jobTitle, organization, recruiterName }),
  });
}

export async function predictSalary(
  role: string,
  experienceYears: number,
  location: string
) {
  return apiFetch<{
    minSalary: number;
    maxSalary: number;
    currency: string;
    marketDemand: string;
  }>("/api/salary-prediction", {
    method: "POST",
    body: JSON.stringify({ role, experienceYears, location }),
  });
}

// ── Applications endpoints ─────────────────────────────────────────────────────
export async function fetchApplications() {
  return apiFetch<unknown[]>("/api/applications");
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string
) {
  return apiFetch(`/api/applications/${applicationId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
