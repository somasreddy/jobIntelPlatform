"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { CandidateProfile } from "./types";
import { loadProfile, saveProfile as saveToLocalStorage } from "./profile";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Map snake_case API response → camelCase CandidateProfile */
function dbToProfile(data: Record<string, unknown>): CandidateProfile {
  return {
    name: (data.name as string) || "",
    currentRole: (data.current_role as string) || "",
    currentSalary: Number(data.current_salary) || 0,
    currency: (data.currency as string) || "USD",
    experienceYears: Number(data.experience_years) || 0,
    workMode: (data.work_mode as string) || "Any",
    currentLocation: (data.current_location as string) || "",
    preferredLocations: (data.preferred_locations as string[]) || [],
    skills: (data.skills as string[]) || [],
    frameworks: (data.frameworks as string[]) || [],
    languages: (data.languages as string[]) || [],
    cicdTools: (data.cicd_tools as string[]) || [],
    aiTools: (data.ai_tools as string[]) || [],
    certifications: (data.certifications as string[]) || [],
    resumeText: (data.base_resume_text as string) || "",
  };
}

/** Map camelCase CandidateProfile → snake_case API body */
function profileToDb(p: CandidateProfile): Record<string, unknown> {
  return {
    name: p.name,
    current_role: p.currentRole,
    current_salary: p.currentSalary,
    currency: p.currency,
    experience_years: p.experienceYears,
    work_mode: p.workMode,
    current_location: p.currentLocation,
    preferred_locations: p.preferredLocations,
    skills: p.skills,
    frameworks: p.frameworks,
    languages: p.languages,
    cicd_tools: p.cicdTools,
    ai_tools: p.aiTools,
    certifications: p.certifications,
    base_resume_text: p.resumeText,
  };
}

async function fetchFromDB(): Promise<CandidateProfile | null> {
  try {
    const res = await fetch(`${API}/api/profile/`, { cache: "no-store" });
    if (!res.ok) return null;
    return dbToProfile(await res.json());
  } catch {
    return null;
  }
}

async function saveToDb(p: CandidateProfile): Promise<void> {
  await fetch(`${API}/api/profile/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileToDb(p)),
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProfileContextValue {
  profile: CandidateProfile | null;
  /** true while loading from API/localStorage on first mount */
  loading: boolean;
  /** Save profile to DB + localStorage and update all consumers instantly */
  saveProfile: (p: CandidateProfile) => Promise<void>;
  /** Re-fetch from DB (call after any external change) */
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  saveProfile: async () => {},
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    // Try DB first, fall back to localStorage
    const dbProfile = await fetchFromDB();
    if (dbProfile) {
      setProfile(dbProfile);
      saveToLocalStorage(dbProfile); // keep cache in sync
    } else {
      // DB unavailable — use localStorage cache
      const cached = loadProfile();
      setProfile(cached);
    }
    setLoading(false);
  }, []);

  // Load on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Sync across tabs: when another tab saves to localStorage, re-read it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "candidateProfile" && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue) as CandidateProfile;
          setProfile(updated);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const saveProfile = useCallback(async (p: CandidateProfile) => {
    // Optimistic update — all consumers see new profile immediately
    setProfile(p);
    // Persist to localStorage cache (also triggers cross-tab storage event)
    saveToLocalStorage(p);
    // Persist to DB (best-effort — don't block UI on failure)
    try {
      await saveToDb(p);
    } catch (err) {
      console.warn("Profile DB save failed, stored in localStorage only:", err);
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, loading, saveProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

/** Hook — use this in any page or component instead of loadProfile() */
export function useProfile() {
  return useContext(ProfileContext);
}
