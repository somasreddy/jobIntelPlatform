// ─── Core Types ───────────────────────────────────────────────────────────────

export interface CandidateProfile {
  name: string;
  currentRole: string;
  currentSalary: number;
  currency: string;
  experienceYears: number;
  workMode: string;
  currentLocation: string;
  preferredLocations: string[];
  skills: string[];
  frameworks: string[];
  languages: string[];
  cicdTools: string[];
  certifications: string[];
  resumeText?: string;
}

export type WorkMode = "Remote" | "Hybrid" | "On-site" | "Any";

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING";

export type ApplicationStatus =
  | "Saved"
  | "Applied"
  | "Assessment"
  | "Interview"
  | "Offer"
  | "Rejected";

export type JobPortal =
  | "LinkedIn" | "Indeed" | "Glassdoor" | "Naukri" | "Adzuna"
  | "Remotive" | "Arbeitnow" | "TheMuse" | "RemoteOK" | "Jobicy"
  | "Direct" | "Other";

export interface Job {
  id: string;
  title: string;
  organization: string;
  location: string;
  workMode: WorkMode;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  experienceRequired: number;
  technologies: string[];
  description: string;
  careerPageLink: string;
  applicationLink: string;
  verificationStatus: VerificationStatus;
  postedDate: string;
  matchScore?: number;
  levelUp: boolean;
  source?: JobPortal;       // which portal this job came from
  recruiterName?: string;
  recruiterLinkedIn?: string;
}

export interface Application {
  id: string;
  jobId: string;
  job: Job;
  status: ApplicationStatus;
  dateApplied: string;
  followUpDate?: string;
  notes?: string;
}

export interface SkillGapItem {
  skill: string;
  category: string;
  demandScore: number; // 0-100
  inProfile: boolean;
  priority: "High" | "Medium" | "Low";
  learningResource?: string;
}

export interface SalaryPrediction {
  role: string;
  location: string;
  experienceYears: number;
  minSalary: number;
  maxSalary: number;
  currency: string;
  marketDemand: "Very High" | "High" | "Medium" | "Low";
}

export interface GeneratedResume {
  jobId: string;
  candidateProfile: CandidateProfile;
  jobDescription: string;
  atsScore: number;
  sections: {
    summary: string;
    coreSkills: string[];
    frameworks: string[];
    experience: ExperienceBullet[];
    certifications: string[];
  };
}

export interface ExperienceBullet {
  original: string;
  enhanced: string;
}

export interface RoadmapPhase {
  phase: number;
  title: string;
  duration: string;
  skills: string[];
  resources: string[];
}
