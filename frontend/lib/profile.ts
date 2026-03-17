import { CandidateProfile } from "./types";

/**
 * Load and type-cast the saved candidate profile from browser storage.
 * Returns null if nothing is saved or if parsing fails.
 */
export function loadProfile(): CandidateProfile | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem("candidateProfile") ||
    sessionStorage.getItem("candidateProfile");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      ...p,
      // Ensure numeric fields are always numbers, not strings from form inputs
      currentSalary: Number(p.currentSalary) || 0,
      experienceYears: Number(p.experienceYears) || 0,
      // Ensure array fields are always arrays
      skills: Array.isArray(p.skills) ? p.skills : [],
      preferredLocations: Array.isArray(p.preferredLocations) ? p.preferredLocations : [],
      frameworks: Array.isArray(p.frameworks) ? p.frameworks : [],
      languages: Array.isArray(p.languages) ? p.languages : [],
      cicdTools: Array.isArray(p.cicdTools) ? p.cicdTools : [],
      certifications: Array.isArray(p.certifications) ? p.certifications : [],
    } as CandidateProfile;
  } catch {
    return null;
  }
}

// ─── Saved Jobs ────────────────────────────────────────────────────────────────

export function getSavedJobIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("savedJobIds") || "[]");
  } catch { return []; }
}

export function toggleSavedJob(id: string): boolean {
  const saved = getSavedJobIds();
  const idx = saved.indexOf(id);
  const isNowSaved = idx === -1;
  if (isNowSaved) saved.push(id);
  else saved.splice(idx, 1);
  localStorage.setItem("savedJobIds", JSON.stringify(saved));
  return isNowSaved;
}

/**
 * Persist the candidate profile to both localStorage and sessionStorage.
 * Strips transient UI fields (resumeFile, preferredLocation temp buffer).
 */
export function saveProfile(data: CandidateProfile & { resumeFile?: unknown; preferredLocation?: string }): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resumeFile: _rf, preferredLocation: _pl, ...clean } = data as Record<string, unknown>;
  const typed: CandidateProfile = {
    ...(clean as CandidateProfile),
    currentSalary: Number((clean as CandidateProfile).currentSalary) || 0,
    experienceYears: Number((clean as CandidateProfile).experienceYears) || 0,
  };
  const json = JSON.stringify(typed);
  localStorage.setItem("candidateProfile", json);
  sessionStorage.setItem("candidateProfile", json);
}
