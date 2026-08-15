import { Job } from "@/lib/types";

export type SourceQuality = "high" | "medium" | "low";

const FIRST_PARTY_SOURCE_TERMS = ["direct", "career", "greenhouse", "lever", "ashby", "workday", "smartrecruiters", "teamtailor", "recruitee", "feed"];
const KNOWN_BOARD_SOURCE_TERMS = ["linkedin", "indeed", "glassdoor", "naukri", "adzuna", "remotive", "arbeitnow", "themuse", "the muse", "remoteok", "jobicy"];

export function getSourceQuality(job: Job): SourceQuality {
  const source = (job.source || "").toLowerCase();
  if (FIRST_PARTY_SOURCE_TERMS.some((term) => source.includes(term))) return "high";
  if (KNOWN_BOARD_SOURCE_TERMS.some((term) => source.includes(term))) return "medium";
  return "low";
}

export function getJobAgeHours(job: Job): number | null {
  if (typeof job.jobFreshnessHours === "number" && Number.isFinite(job.jobFreshnessHours)) return Math.max(0, job.jobFreshnessHours);
  const timestamp = Date.parse(job.postedDate);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

export function getFreshnessLabel(job: Job): { label: string; fresh: boolean } {
  const hours = getJobAgeHours(job);
  if (hours === null) return { label: "Date unavailable", fresh: false };
  if (hours < 1) return { label: "Posted recently", fresh: true };
  if (hours < 24) return { label: `${Math.max(1, Math.floor(hours))}h old`, fresh: true };
  const days = Math.floor(hours / 24);
  if (days < 7) return { label: `${days}d old`, fresh: days <= 3 };
  if (days < 30) return { label: `${Math.floor(days / 7)}w old`, fresh: false };
  return { label: `${Math.floor(days / 30)}mo old`, fresh: false };
}

export function getJobConfidence(job: Job): { value: number; estimated: boolean } {
  if (typeof job.extractionConfidence === "number" && Number.isFinite(job.extractionConfidence)) {
    const normalized = job.extractionConfidence <= 1 ? job.extractionConfidence * 100 : job.extractionConfidence;
    return { value: Math.max(0, Math.min(100, Math.round(normalized))), estimated: false };
  }
  const quality = getSourceQuality(job);
  const verificationBase = job.verificationStatus === "VERIFIED" ? 72 : job.verificationStatus === "PENDING" ? 52 : 32;
  const sourceAdjustment = quality === "high" ? 13 : quality === "medium" ? 5 : -5;
  const age = getJobAgeHours(job);
  const freshnessAdjustment = age !== null && age <= 72 ? 5 : age !== null && age > 30 * 24 ? -5 : 0;
  return { value: Math.max(0, Math.min(100, verificationBase + sourceAdjustment + freshnessAdjustment)), estimated: true };
}

export function hasSalary(job: Job): boolean {
  return job.salaryDisclosed === true || job.salaryMin > 0 || job.salaryMax > 0;
}
