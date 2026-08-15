"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useProfile } from "@/lib/ProfileContext";
import { loadProfile } from "@/lib/profile";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import ProfileIntelligenceReview from "@/components/profile-intelligence/ProfileIntelligenceReview";
import {
  User, Briefcase, DollarSign, MapPin, Clock,
  Plus, X, Upload, ChevronRight, ChevronDown, ChevronUp,
  Sparkles, CheckCircle, CheckCircle2, TrendingUp, Award,
  Zap, Edit3, Cpu, FileText, ShieldAlert, FileOutput,
  UserCircle2, Target, AlertCircle, Download, Loader2,
  ArrowLeft, XCircle, Copy, Check, RefreshCw, Eye, EyeOff,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type TabId = "profile" | "resume" | "match";

// ─── Profile Tab: constants ────────────────────────────────────────────────────
const AI_USER_SKILLS = [
  "ChatGPT", "Claude (Anthropic)", "Gemini", "Copilot", "Perplexity AI",
  "Midjourney", "DALL-E", "Stable Diffusion", "Runway ML", "ElevenLabs",
  "Vibe Coding", "AI Prompting", "Prompt Engineering", "AI-Assisted Development",
  "AI Generalist", "AI Application Development", "No-Code AI", "Low-Code AI",
  "AI Automation", "Cursor IDE", "Windsurf IDE", "GitHub Copilot",
  "AI Workflow Automation", "Make (Integromat) + AI", "Zapier AI",
  "n8n AI Automation", "Notion AI", "Grammarly AI", "AI Research",
  "AI Content Generation", "AI Image Generation", "AI Video Generation",
];
const AI_DEV_SKILLS = [
  "LangChain", "LangGraph", "LlamaIndex", "OpenAI API", "Anthropic API",
  "Hugging Face", "Groq", "Mistral AI", "Google AI / Gemini API", "Vertex AI",
  "AWS Bedrock", "Azure OpenAI", "RAG (Retrieval Augmented Generation)",
  "Vector Databases", "Fine-Tuning LLMs", "CrewAI", "AutoGen",
  "Semantic Kernel", "LangSmith", "Ollama", "Pinecone", "Weaviate",
  "Chroma", "pgvector", "Embeddings", "AI Agents", "Multimodal AI",
];
const SKILL_CATEGORIES: Record<string, string[]> = {
  "Frontend": ["React","Next.js","Vue.js","Angular","Svelte","TypeScript","JavaScript","HTML/CSS","Tailwind CSS","Redux","Zustand","Webpack","Vite","Storybook","Accessibility (a11y)","Web Performance","PWA","Three.js","D3.js"],
  "Backend": ["Node.js","Python","Java","Go","Rust","C++","C#",".NET","Spring Boot","FastAPI","Django","Flask","Express","NestJS","Ruby on Rails","PHP","Laravel","Elixir","Phoenix","Scala","Akka"],
  "Mobile": ["React Native","Flutter","Swift","Kotlin","Android","iOS","Expo","Jetpack Compose","SwiftUI","Xamarin","Capacitor"],
  "Data & AI/ML": ["Machine Learning","Deep Learning","PyTorch","TensorFlow","Keras","Scikit-learn","Pandas","NumPy","Spark","Kafka","Flink","Airflow","dbt","NLP","LLMs","RAG","LangChain","Hugging Face","MLflow","Data Pipelines","Feature Engineering","A/B Testing","Statistics"],
  "Cloud & DevOps": ["AWS","Azure","GCP","Docker","Kubernetes","Helm","ArgoCD","Terraform","Pulumi","Ansible","GitHub Actions","GitLab CI/CD","Jenkins","Azure DevOps Pipelines","CircleCI","Prometheus","Grafana","Datadog","OpenTelemetry","Linux","Site Reliability Engineering","GitOps","Platform Engineering"],
  "Databases": ["PostgreSQL","MySQL","Oracle Database","SQL Server (MSSQL)","MongoDB","Redis","DynamoDB","Elasticsearch","Snowflake","Google BigQuery","Amazon Redshift","Neo4j","InfluxDB","Prisma","Sequelize","Vector Databases (pgvector, Pinecone, Weaviate)"],
  "Testing & QA": ["Selenium","Playwright","Cypress","Jest","Vitest","Pytest","JUnit","TestNG","Postman","JMeter","K6","Appium","REST Assured","BDD/Cucumber","Load Testing","Chaos Engineering"],
  "Architecture & Design": ["System Design","Microservices","Event-Driven Architecture","CQRS","Domain-Driven Design","REST APIs","gRPC","GraphQL APIs","OpenAPI","Message Queues","RabbitMQ","WebSockets","OAuth 2.0","JWT"],
  "B2B Integration": ["webMethods Integration Server","webMethods.IO Integration","webMethods Trading Networks","MuleSoft Anypoint Platform","Dell Boomi AtomSphere","IBM Sterling B2B Integrator","IBM MQ","TIBCO BusinessWorks","SAP Integration Suite","EDI X12","EDIFACT","AS2 (EDIINT)","BPMN 2.0","SOAP/WSDL"],
  "API Management": ["webMethods API Gateway","Kong Gateway","AWS API Gateway","Azure API Management (APIM)","Google Apigee","MuleSoft API Manager","OpenAPI 3.x / Swagger","OAuth 2.0","API Security (OWASP API Top 10)","Postman","API Contract Testing","WireMock"],
  "Tools & Practices": ["Git","GitHub","GitLab","JIRA","Confluence","Figma","Agile/Scrum","Kanban","Code Review","Technical Writing","Trunk-Based Development","Feature Flags"],
};
const ALL_SKILLS = Object.values(SKILL_CATEGORIES).flat();

function getOrderedCategories(role: string): [string, string[]][] {
  const all = Object.entries(SKILL_CATEGORIES);
  const priorities: Record<string, number> = {};
  if (/front.?end|ui engineer|react dev|vue|angular|web dev/i.test(role)) {
    Object.assign(priorities, { "Frontend": 10, "Architecture & Design": 8, "Testing & QA": 7, "Backend": 6 });
  } else if (/back.?end|api|server|micro.?service|node|java|spring|django|fastapi/i.test(role)) {
    Object.assign(priorities, { "Backend": 10, "Databases": 9, "Architecture & Design": 8, "Cloud & DevOps": 7 });
  } else if (/full.?stack/i.test(role)) {
    Object.assign(priorities, { "Frontend": 10, "Backend": 10, "Databases": 8, "Architecture & Design": 7, "Cloud & DevOps": 6 });
  } else if (/mobile|ios|android|flutter|react native/i.test(role)) {
    Object.assign(priorities, { "Mobile": 10, "Backend": 7, "Architecture & Design": 6 });
  } else if (/data engineer|data pipeline|etl/i.test(role)) {
    Object.assign(priorities, { "Data & AI/ML": 10, "Databases": 10, "Cloud & DevOps": 8 });
  } else if (/machine learning|ml engineer|data scientist|ai engineer/i.test(role)) {
    Object.assign(priorities, { "Data & AI/ML": 10, "Databases": 7, "Cloud & DevOps": 7 });
  } else if (/devops|sre|platform|infra|cloud|kubernetes|terraform/i.test(role)) {
    Object.assign(priorities, { "Cloud & DevOps": 10, "Architecture & Design": 8, "Databases": 6 });
  } else if (/qa|quality|test|sdet|automation/i.test(role)) {
    Object.assign(priorities, { "Testing & QA": 10, "Architecture & Design": 7, "Backend": 7 });
  } else if (/b2b|integration|webmethod|edi|bpm|mulesoft|boomi|tibco|middleware/i.test(role)) {
    Object.assign(priorities, { "B2B Integration": 10, "API Management": 9, "Architecture & Design": 8 });
  } else if (/api management|kong|apigee|apim/i.test(role)) {
    Object.assign(priorities, { "API Management": 10, "B2B Integration": 8, "Architecture & Design": 9 });
  } else if (/architect|principal|staff|tech lead/i.test(role)) {
    Object.assign(priorities, { "Architecture & Design": 10, "Backend": 8, "Cloud & DevOps": 8, "Databases": 7 });
  }
  return all.sort(([a], [b]) => (priorities[b] ?? 0) - (priorities[a] ?? 0));
}

function calcCompleteness(form: { name: string; currentRole: string; currentSalary: string; experienceYears: string; currentLocation: string; skills: string[]; workMode: string; preferredLocations: string[]; resumeFile: File | null; resumeText: string; }): number {
  let pts = 0;
  if (form.name.trim())                         pts += 12;
  if (form.currentRole.trim())                  pts += 12;
  if (Number(form.experienceYears) > 0)         pts += 8;
  if (Number(form.currentSalary) > 0)           pts += 5;
  if (form.currentLocation.trim())              pts += 8;
  if (form.skills.length >= 3)                  pts += 12;
  if (form.skills.length >= 8)                  pts += 8;
  if (form.workMode !== "Any")                  pts += 5;
  if (form.preferredLocations.length > 0)       pts += 8;
  if (form.resumeFile || form.resumeText.trim()) pts += 12;
  if (form.resumeText.trim().length > 200)      pts += 10;
  return Math.min(pts, 100);
}

function calcCareerScore(form: { name: string; currentRole: string; currentSalary: string; experienceYears: string; currentLocation: string; skills: string[]; frameworks: string[]; languages: string[]; cicdTools: string[]; certifications: string[]; preferredLocations: string[]; resumeFile: File | null; resumeText: string; }): { total: number; breakdown: { label: string; score: number; max: number; color: string }[] } {
  const skillsTotal = form.skills.length + form.frameworks.length + form.languages.length + form.cicdTools.length;
  const skillsScore = Math.min(35, Math.round((skillsTotal / 20) * 35));
  const expYears = Number(form.experienceYears);
  const expScore = expYears >= 8 ? 20 : expYears >= 4 ? 16 : expYears >= 2 ? 12 : expYears >= 1 ? 8 : 0;
  const profileScore = (form.name.trim() ? 4 : 0) + (form.currentRole.trim() ? 4 : 0) + (form.currentLocation.trim() ? 4 : 0) + (form.preferredLocations.length > 0 ? 3 : 0);
  const resumeScore = (form.resumeFile ? 8 : 0) + (form.resumeText.trim().length > 500 ? 12 : form.resumeText.trim().length > 100 ? 8 : form.resumeText.trim() ? 4 : 0) + (form.certifications.length > 0 ? 5 : 0);
  return {
    total: Math.min(100, skillsScore + expScore + profileScore + resumeScore),
    breakdown: [
      { label: "Skills & Tech", score: skillsScore, max: 35, color: "#6366f1" },
      { label: "Experience",    score: expScore,    max: 20, color: "#06b6d4" },
      { label: "Profile Info",  score: profileScore, max: 15, color: "#a78bfa" },
      { label: "Resume & Certs", score: resumeScore, max: 30, color: "#10b981" },
    ],
  };
}

const DEFAULT_FORM = {
  name: "", currentRole: "", currentSalary: "", currency: "USD",
  experienceYears: "", workMode: "Any", currentLocation: "",
  preferredLocations: [] as string[], preferredLocation: "",
  skills: [] as string[], frameworks: [] as string[], languages: [] as string[],
  cicdTools: [] as string[], aiTools: [] as string[], certifications: [] as string[],
  resumeText: "", resumeFile: null as File | null,
};

// ─── Resume Tab: constants ─────────────────────────────────────────────────────
const ATS_KEYWORD_POOL = [
  "System Design","Microservices","REST APIs","GraphQL","Docker","Kubernetes",
  "CI/CD","GitHub Actions","AWS","Azure","GCP","Terraform","Agile","Scrum",
  "Code Review","TDD","Unit Testing","Integration Testing","End-to-End Testing",
  "Performance Testing","Load Testing","React","Node.js","TypeScript","Python",
  "Java","Go","PostgreSQL","MongoDB","Redis","Elasticsearch","Kafka","Spark",
  "Machine Learning","Data Pipelines","Feature Engineering","MLOps","LLMs",
  "Playwright","Selenium","Cypress","Jest","Pytest","Postman",
  "Jenkins","ArgoCD","Helm","Prometheus","Grafana","OpenTelemetry",
];

function calcKeywordHeatmap(resumeText: string, profileSkills: string[]): { keyword: string; inResume: boolean; inProfile: boolean; priority: "High" | "Medium" | "Low" }[] {
  const text = (resumeText || "").toLowerCase();
  const allSkills = profileSkills.map(s => s.toLowerCase());
  return ATS_KEYWORD_POOL.map((kw) => {
    const kwLower = kw.toLowerCase();
    return {
      keyword: kw,
      inResume: text.includes(kwLower),
      inProfile: allSkills.some(s => s.includes(kwLower) || kwLower.includes(s)),
      priority: ["System Design","Microservices","CI/CD","Docker","Kubernetes","AWS","TypeScript","React","Python","Go"].includes(kw) ? "High"
        : ["REST APIs","GraphQL","PostgreSQL","MongoDB","Redis","Kafka","Agile","TDD","Playwright","Jest"].includes(kw) ? "Medium"
        : "Low",
    };
  });
}

// ─── JD Match Tab: constants ───────────────────────────────────────────────────
const STOP_WORDS = new Set(["the","and","for","are","with","that","this","have","from","will","your","you","our","their","they","been","has","had","was","were","not","but","more","also","what","when","which","who","how","its","use","can","all","any","one","two","new","work","team","role","job","hire","help","make","build","able"]);
const CRITICAL_TECH = new Set(["python","java","typescript","javascript","go","rust","sql","nosql","react","node","fastapi","spring","django","kubernetes","docker","aws","azure","gcp","ci/cd","terraform","kafka","redis","postgres","postgresql","mongodb","graphql","rest","api","microservices","playwright","selenium","cypress","pytest","jest","junit","machine learning","deep learning","llm","langchain","mlops","system design","distributed systems","data pipelines"]);

interface KeywordMatch { term: string; inJd: boolean; inResume: boolean; jdFreq: number; resumeFreq: number; priority: "critical" | "important" | "nice"; }

function extractKeywords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().replace(/[^a-z0-9+#.\-/ ]/g, " ").split(/\s+/);
  words.forEach(w => { if (w.length >= 4 && !STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1); });
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (words[i].length >= 3 && words[i + 1].length >= 3 && !STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1]))
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  return counts;
}

function analyzeKeywords(jdText: string, resumeText: string): KeywordMatch[] {
  const jdKws = extractKeywords(jdText);
  const resumeKws = extractKeywords(resumeText);
  const results: KeywordMatch[] = [];
  jdKws.forEach((jdFreq, term) => {
    const resumeFreq = resumeKws.get(term) ?? 0;
    const isCritical = CRITICAL_TECH.has(term) || jdFreq >= 3;
    results.push({ term, inJd: true, inResume: resumeFreq > 0, jdFreq, resumeFreq, priority: isCritical ? "critical" : jdFreq >= 2 ? "important" : "nice" });
  });
  return results.filter(k => k.term.length >= 4).sort((a, b) => {
    const missingA = !a.inResume ? 1 : 0, missingB = !b.inResume ? 1 : 0;
    const priorityOrder = { critical: 0, important: 1, nice: 2 };
    if (missingA !== missingB) return missingB - missingA;
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return b.jdFreq - a.jdFreq;
  }).slice(0, 60);
}

function highlightText(text: string, keywords: KeywordMatch[], mode: "resume" | "jd"): React.ReactNode[] {
  if (!text || keywords.length === 0) return [<span key="raw">{text}</span>];
  const matchingTerms = keywords.filter(k => mode === "resume" ? k.inJd : k.inResume).map(k => ({ term: k.term, priority: k.priority, inResume: k.inResume }));
  if (matchingTerms.length === 0) return [<span key="raw">{text}</span>];
  const sorted = [...matchingTerms].sort((a, b) => b.term.length - a.term.length);
  const pattern = sorted.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  const termMap = new Map(sorted.map(t => [t.term.toLowerCase(), t]));
  return parts.map((part, i) => {
    const match = termMap.get(part.toLowerCase());
    if (match) {
      const color = match.priority === "critical"
        ? mode === "resume" ? "bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/50" : "bg-cyan-500/20 text-cyan-300 border-b border-cyan-500/50"
        : match.priority === "important"
        ? mode === "resume" ? "bg-blue-500/15 text-blue-300 border-b border-blue-500/40" : "bg-violet-500/15 text-violet-300 border-b border-violet-500/40"
        : mode === "resume" ? "bg-slate-500/20 text-slate-300" : "bg-slate-500/20 text-slate-300";
      return <mark key={i} className={`rounded px-0.5 not-italic font-medium ${color}`}>{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

function calcMatchScore(keywords: KeywordMatch[]): { score: number; critical: number; important: number; missing: string[] } {
  const criticals = keywords.filter(k => k.priority === "critical");
  const importants = keywords.filter(k => k.priority === "important");
  const critHit = criticals.filter(k => k.inResume).length;
  const impHit = importants.filter(k => k.inResume).length;
  const niceHit = keywords.filter(k => k.priority === "nice" && k.inResume).length;
  const total = criticals.length * 3 + importants.length * 2 + keywords.filter(k => k.priority === "nice").length;
  const got = critHit * 3 + impHit * 2 + niceHit;
  return { score: total > 0 ? Math.round((got / total) * 100) : 0, critical: critHit, important: impHit, missing: keywords.filter(k => !k.inResume && k.priority !== "nice").map(k => k.term).slice(0, 12) };
}

// ─── Tab 1: Profile Editor ────────────────────────────────────────────────────
function ProfileTab({ onTabChange }: { onTabChange: (t: TabId) => void }) {
  const { saveProfile, profile: ctxProfile } = useProfile();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [dragging, setDragging] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [aiSkillSearch, setAiSkillSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [aiTab, setAiTab] = useState<"user" | "dev">("user");
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const profileApplied = useRef(false);

  const toggleCategory = (cat: string) => setCollapsedCategories((p) => ({ ...p, [cat]: !p[cat] }));

  const applyParsedData = (d: Record<string, unknown>) => {
    setForm(p => ({
      ...p,
      name: (d.name as string) || p.name,
      currentRole: (d.current_role as string) || p.currentRole,
      experienceYears: d.experience_years ? String(d.experience_years) : p.experienceYears,
      currentLocation: (d.current_location as string) || p.currentLocation,
      workMode: d.work_mode && d.work_mode !== "Any" ? (d.work_mode as string) : p.workMode,
      resumeText: (d.resume_text as string) || p.resumeText,
      skills: [...new Set([...p.skills, ...((d.skills as string[]) || [])])],
      frameworks: [...new Set([...p.frameworks, ...((d.frameworks as string[]) || [])])],
      languages: [...new Set([...p.languages, ...((d.languages as string[]) || [])])],
      cicdTools: [...new Set([...p.cicdTools, ...((d.cicd_tools as string[]) || [])])],
      aiTools: [...new Set([...p.aiTools, ...((d.ai_tools as string[]) || [])])],
      certifications: [...new Set([...p.certifications, ...((d.certifications as string[]) || [])])],
    }));
    const count = ((d.skills as string[])?.length || 0) + ((d.frameworks as string[])?.length || 0) + ((d.languages as string[])?.length || 0) + ((d.cicd_tools as string[])?.length || 0) + ((d.ai_tools as string[])?.length || 0);
    setParseMessage({ type: "success", text: `✓ Auto-filled: ${d.name ? "name, " : ""}${d.current_role ? "role, " : ""}${count} skills detected. Review and adjust below.` });
  };

  const parseResumeAndFill = async () => {
    setParsing(true); setParseMessage(null);
    try {
      if (form.resumeFile && (form.resumeFile.name.endsWith(".pdf") || form.resumeFile.name.endsWith(".docx") || form.resumeFile.name.endsWith(".doc"))) {
        const fd = new FormData(); fd.append("file", form.resumeFile);
        const res = await fetch(`${API}/api/profile/parse-resume-file`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        applyParsedData(await res.json());
      } else {
        const text = form.resumeText.trim();
        if (!text || text.startsWith("[Resume file:")) { setParseMessage({ type: "error", text: "Upload a PDF/DOCX or paste resume text below first." }); setParsing(false); return; }
        const res = await fetch(`${API}/api/profile/parse-resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_text: text }) });
        if (!res.ok) throw new Error(await res.text());
        applyParsedData(await res.json());
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      let detail = raw;
      try { detail = JSON.parse(raw)?.detail || raw; } catch { /* ignore */ }
      setParseMessage({ type: "error", text: raw.includes("fetch") || raw.includes("NetworkError") ? "⚠ Backend not reachable — make sure the backend server is running on port 8000." : `⚠ ${detail.slice(0, 150)}` });
    } finally { setParsing(false); }
  };

  const applyProfileToForm = (saved: NonNullable<typeof ctxProfile>) => {
    if (profileApplied.current) return;
    profileApplied.current = true;
    setForm(p => ({ ...p, name: saved.name ?? "", currentRole: saved.currentRole ?? "", currentSalary: saved.currentSalary ? String(saved.currentSalary) : "", currency: saved.currency ?? "USD", experienceYears: saved.experienceYears ? String(saved.experienceYears) : "", workMode: saved.workMode ?? "Any", currentLocation: saved.currentLocation ?? "", preferredLocations: saved.preferredLocations ?? [], skills: saved.skills ?? [], frameworks: saved.frameworks ?? [], languages: saved.languages ?? [], cicdTools: saved.cicdTools ?? [], aiTools: saved.aiTools ?? [], certifications: saved.certifications ?? [], resumeText: saved.resumeText ?? "" }));
    setViewMode(true);
  };

  useEffect(() => { if (ctxProfile) applyProfileToForm(ctxProfile); }, [ctxProfile]); // eslint-disable-line
  useEffect(() => { const saved = loadProfile(); if (saved) applyProfileToForm(saved); }, []); // eslint-disable-line

  const addSkill = (skill: string) => { if (!form.skills.includes(skill)) setForm(p => ({ ...p, skills: [...p.skills, skill] })); };
  const removeSkill = (skill: string) => setForm(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }));
  const addLocation = () => { const loc = form.preferredLocation.trim(); if (loc && !form.preferredLocations.includes(loc)) setForm(p => ({ ...p, preferredLocations: [...p.preferredLocations, loc], preferredLocation: "" })); };

  const extractAndSetFile = (f: File) => {
    setForm(p => ({ ...p, resumeFile: f })); setParseMessage(null);
    if (f.type === "text/plain" || f.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => { const text = ev.target?.result as string; if (text) setForm(p => ({ ...p, resumeText: text.slice(0, 8000) })); };
      reader.readAsText(f);
    } else { setForm(p => ({ ...p, resumeText: p.resumeText || `[Resume file: ${f.name}]` })); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) extractAndSetFile(f); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resumeFile && !form.resumeText.trim()) { document.getElementById("resume-section")?.scrollIntoView({ behavior: "smooth" }); return; }
    await saveProfile({ name: form.name, currentRole: form.currentRole, currentSalary: Number(form.currentSalary) || 0, currency: form.currency, experienceYears: Number(form.experienceYears) || 0, workMode: form.workMode, currentLocation: form.currentLocation, preferredLocations: form.preferredLocations, skills: form.skills, frameworks: form.frameworks, languages: form.languages, cicdTools: form.cicdTools, aiTools: form.aiTools, certifications: form.certifications, resumeText: form.resumeText });
    setViewMode(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredSkills = ALL_SKILLS.filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()) && !form.skills.includes(s));

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
          <Sparkles className="w-4 h-4" /> AI-Powered Career Uplift Engine
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Tell us about your <span className="gradient-text">career profile</span>
        </h1>
        <p className="text-slate-400 text-base mb-4">
          We&apos;ll find verified jobs at the{" "}
          <span className="text-indigo-300 font-medium">same level with higher salary</span>{" "}
          or <span className="text-emerald-300 font-medium">next career level</span> you&apos;re ready for.
        </p>
        {!viewMode && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))", border: "1px solid rgba(99,102,241,0.25)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
              <Upload className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">💡 Start with your Resume for the fastest setup</p>
              <p className="text-xs text-slate-400 mt-0.5">Paste or upload your resume below → click <span className="text-indigo-300 font-medium">✨ Auto-fill Profile</span> → AI extracts your name, role, skills, and tools instantly.</p>
            </div>
            <button type="button" onClick={() => document.getElementById("resume-section")?.scrollIntoView({ behavior: "smooth" })} className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
              Go to Resume ↓
            </button>
          </div>
        )}
      </div>

      {viewMode ? (
        <div className="space-y-4">
          <div className="card py-3 px-4 flex items-center gap-3 border-emerald-500/20">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Profile saved successfully</p>
              <p className="text-xs text-slate-400">Your AI-powered job matching is active</p>
            </div>
            <button onClick={() => setViewMode(false)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent-bright)", border: "1px solid var(--border-hover)" }}>
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          </div>
          <ProfileIntelligenceReview profile={form} onEdit={() => setViewMode(false)} />
          <div className="hidden" aria-hidden="true">
          <div className="card py-4 px-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", border: "1px solid var(--border-hover)" }}>
                {form.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white">{form.name}</h2>
                <p className="text-sm text-slate-400">{form.currentRole}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.experienceYears && <span className="badge badge-tech"><Clock className="w-3 h-3" /> {form.experienceYears} yrs exp</span>}
                  {form.currentLocation && <span className="badge badge-tech"><MapPin className="w-3 h-3" /> {form.currentLocation}</span>}
                  {form.workMode && form.workMode !== "Any" && <span className="badge badge-new">{form.workMode}</span>}
                  {form.currentSalary && <span className="badge badge-tech">{form.currency} {Number(form.currentSalary).toLocaleString()}</span>}
                </div>
              </div>
            </div>
          </div>
          {[
            { label: "Skills", items: form.skills, color: "#6366f1" },
            { label: "AI Tools & Skills", items: form.aiTools, color: "#a78bfa" },
            { label: "Frameworks", items: form.frameworks, color: "#22d3ee" },
            { label: "Languages", items: form.languages, color: "#34d399" },
            { label: "CI/CD & DevOps", items: form.cicdTools, color: "#fb923c" },
            { label: "Certifications", items: form.certifications, color: "#fbbf24" },
          ].filter(s => s.items.length > 0).map(({ label, items, color }) => (
            <div key={label} className="card py-3 px-5">
              <p className="text-xs font-semibold mb-2" style={{ color }}>{label} <span className="text-slate-500 font-normal">({items.length})</span></p>
              <div className="flex flex-wrap gap-1.5">
                {items.map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border font-medium" style={{ background: `${color}12`, color, borderColor: `${color}30` }}>{s}</span>)}
              </div>
            </div>
          ))}
          {form.resumeText && !form.resumeText.startsWith("[Resume file:") && (
            <div className="card py-3 px-5">
              <p className="text-xs font-semibold text-slate-400 mb-2">Resume Text <span className="text-slate-500">({form.resumeText.length} chars)</span></p>
              <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed font-mono">{form.resumeText}</p>
            </div>
          )}
          </div>
          <button onClick={() => onTabChange("resume")} className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm">
            <FileText className="w-4 h-4" /> View Resume & ATS Score <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const pct = calcCompleteness(form);
            const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-indigo-500" : "bg-amber-500";
            const label = pct >= 80 ? "Great profile!" : pct >= 50 ? "Keep going" : "Just started";
            return (
              <div className="card py-3 px-4 mb-2 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-400">Profile Completeness</span>
                    <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-indigo-400" : "text-amber-400"}`}>{pct}% — {label}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
                    <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}
          {(() => {
            const cs = calcCareerScore(form);
            const level = cs.total >= 80 ? "Expert" : cs.total >= 60 ? "Advanced" : cs.total >= 35 ? "Intermediate" : "Beginner";
            const levelColor = cs.total >= 80 ? "text-emerald-400" : cs.total >= 60 ? "text-indigo-400" : cs.total >= 35 ? "text-amber-400" : "text-rose-400";
            const ringColor = cs.total >= 80 ? "#10b981" : cs.total >= 60 ? "#6366f1" : cs.total >= 35 ? "#f59e0b" : "#f43f5e";
            const circ = 2 * Math.PI * 28; const fill = (cs.total / 100) * circ;
            return (
              <div className="card py-4 px-4 mb-2">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <svg width="72" height="72" className="-rotate-90">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="6" />
                      <circle cx="36" cy="36" r="28" fill="none" stroke={ringColor} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={circ - fill} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold" style={{ color: ringColor }}>{cs.total}</span>
                      <span className="text-[9px] text-slate-500 leading-none">/ 100</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-white">Career Score</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 ${levelColor}`}>{level}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                      {cs.breakdown.map(({ label, score, max, color }) => (
                        <div key={label}>
                          <div className="flex justify-between text-[10px] mb-0.5"><span className="text-slate-500">{label}</span><span style={{ color }}>{score}/{max}</span></div>
                          <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(score / max) * 100}%`, background: color }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" /> Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0"><label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label><input className="input w-full" placeholder="Enter your full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="min-w-0"><label className="block text-xs font-medium text-slate-400 mb-1.5">Current Role</label><input className="input w-full" placeholder="e.g. Software Engineer, Product Manager" value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))} required /></div>
              </div>
            </div>
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-indigo-400" /> Career Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5"><DollarSign className="w-3 h-3 inline mr-0.5" /> Current Salary</label>
                  <div className="flex gap-2 w-full">
                    <select className="input w-20 shrink-0" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                      {["USD","INR","GBP","EUR","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="input w-0 flex-1" type="number" placeholder="e.g. 80000" value={form.currentSalary} onChange={e => setForm(p => ({ ...p, currentSalary: e.target.value }))} />
                  </div>
                </div>
                <div className="min-w-0"><label className="block text-xs font-medium text-slate-400 mb-1.5"><Clock className="w-3 h-3 inline mr-0.5" /> Experience (years)</label><input className="input w-full" type="number" placeholder="e.g. 5" value={form.experienceYears} onChange={e => setForm(p => ({ ...p, experienceYears: e.target.value }))} required /></div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Work Mode</label>
                  <select className="input w-full" value={form.workMode} onChange={e => setForm(p => ({ ...p, workMode: e.target.value }))}>
                    {["Any","Remote","Hybrid","On-site"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-400" /> Location Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0"><label className="block text-xs font-medium text-slate-400 mb-1.5">Current Location</label><LocationAutocomplete value={form.currentLocation} onChange={v => setForm(p => ({ ...p, currentLocation: v }))} placeholder="e.g. Bangalore, India" /></div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Job Locations</label>
                  <div className="flex gap-2 mb-2">
                    <LocationAutocomplete value={form.preferredLocation} onChange={v => setForm(p => ({ ...p, preferredLocation: v }))} onSelect={v => { if (v && !form.preferredLocations.includes(v)) setForm(p => ({ ...p, preferredLocations: [...p.preferredLocations, v], preferredLocation: "" })); }} placeholder="Type city and select or press +" className="flex-1" />
                    <button type="button" onClick={addLocation} className="btn-secondary px-3 shrink-0"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.preferredLocations.map(loc => (
                      <span key={loc} className="flex items-center gap-1 badge badge-tech">{loc}<button type="button" onClick={() => setForm(p => ({ ...p, preferredLocations: p.preferredLocations.filter(l => l !== loc) }))}><X className="w-3 h-3" /></button></span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> Known Technologies & Skills</h2>
                {form.currentRole && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-medium">Tailored for: {form.currentRole}</span>}
              </div>
              <input className="input mb-3" placeholder="Search any technology…" value={skillSearch} onChange={e => setSkillSearch(e.target.value)} />
              {skillSearch && filteredSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {filteredSkills.slice(0, 12).map(s => <button key={s} type="button" onClick={() => { addSkill(s); setSkillSearch(""); }} className="tag cursor-pointer hover:bg-indigo-500/20 transition-colors"><Plus className="w-3 h-3" /> {s}</button>)}
                </div>
              )}
              {!skillSearch && (
                <div className="space-y-1.5 mb-3">
                  {getOrderedCategories(form.currentRole).map(([category, skills]) => {
                    const available = skills.filter(s => !form.skills.includes(s));
                    if (available.length === 0) return null;
                    const idx = getOrderedCategories(form.currentRole).findIndex(([c]) => c === category);
                    const defaultOpen = idx < 3;
                    const open = collapsedCategories[category] !== undefined ? collapsedCategories[category] : defaultOpen;
                    return (
                      <div key={category} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        <button type="button" onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{category}</span>
                          <div className="flex items-center gap-2"><span className="text-[10px] text-slate-500">{available.length}</span><ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} /></div>
                        </button>
                        {open && <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">{available.map(s => <button key={s} type="button" onClick={() => addSkill(s)} className="tag cursor-pointer text-[11px]">+ {s}</button>)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              {form.skills.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Selected ({form.skills.length}):</p>
                  <div className="flex flex-wrap gap-2">{form.skills.map(s => <span key={s} className="flex items-center gap-1 badge badge-verified text-xs">{s}<button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button></span>)}</div>
                </div>
              )}
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Cpu className="w-4 h-4 text-violet-400" /> AI Tools & Skills</h2>
                <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded font-medium">{form.aiTools.length} selected</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Add AI tools you use daily — as a user, creator, or developer. This boosts your match score for AI-forward roles.</p>
              <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                {(["user", "dev"] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setAiTab(tab)} className="flex-1 text-xs py-1.5 rounded-md font-medium transition-all" style={aiTab === tab ? { background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent-bright)", border: "1px solid var(--border-hover)" } : { color: "var(--text-muted)" }}>
                    {tab === "user" ? "🤖 AI User Skills" : "⚡ AI Dev / Engineering"}
                  </button>
                ))}
              </div>
              <input className="input mb-3 text-sm" placeholder={aiTab === "user" ? "Search: ChatGPT, Midjourney…" : "Search: LangChain, OpenAI API…"} value={aiSkillSearch} onChange={e => setAiSkillSearch(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(aiTab === "user" ? AI_USER_SKILLS : AI_DEV_SKILLS).filter(s => !form.aiTools.includes(s) && (aiSkillSearch === "" || s.toLowerCase().includes(aiSkillSearch.toLowerCase()))).slice(0, 20).map(s => (
                  <button key={s} type="button" onClick={() => setForm(p => ({ ...p, aiTools: [...p.aiTools, s] }))} className="tag cursor-pointer text-[11px]" style={{ borderColor: "rgba(139,92,246,0.3)", color: "#c4b5fd" }}>+ {s}</button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <input className="input text-sm flex-1" placeholder="Type any AI tool not listed and press +" id="ai-tool-custom" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val && !form.aiTools.includes(val)) { setForm(p => ({ ...p, aiTools: [...p.aiTools, val] })); (e.target as HTMLInputElement).value = ""; } } }} />
                <button type="button" className="btn-secondary px-3 shrink-0" onClick={() => { const el = document.getElementById("ai-tool-custom") as HTMLInputElement; const val = el?.value.trim(); if (val && !form.aiTools.includes(val)) { setForm(p => ({ ...p, aiTools: [...p.aiTools, val] })); el.value = ""; } }}><Plus className="w-4 h-4" /></button>
              </div>
              {form.aiTools.length > 0 && (
                <div><p className="text-xs text-slate-400 mb-2">Selected ({form.aiTools.length}):</p>
                  <div className="flex flex-wrap gap-2">{form.aiTools.map(s => <span key={s} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium" style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", borderColor: "rgba(139,92,246,0.3)" }}>{s}<button type="button" onClick={() => setForm(p => ({ ...p, aiTools: p.aiTools.filter(t => t !== s) }))}><X className="w-3 h-3" /></button></span>)}</div>
                </div>
              )}
            </div>
            <div id="resume-section" className={`card ${!form.resumeFile && !form.resumeText.trim() ? "border-rose-500/30" : "border-emerald-500/20"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2"><Upload className="w-4 h-4 text-indigo-400" /> Resume / CV <span className="text-rose-400 text-xs font-bold">* Required</span>{(form.resumeFile || form.resumeText.trim()) && <CheckCircle className="w-4 h-4 text-emerald-400" />}</h2>
                  <p className="text-xs text-slate-500 mt-1">Upload or paste → click <span className="text-violet-400 font-semibold">✨ Auto-fill</span> to extract your profile automatically</p>
                </div>
                <button type="button" onClick={parseResumeAndFill} disabled={parsing || (!form.resumeFile && (!form.resumeText.trim() || form.resumeText.startsWith("[Resume file:")))} className="shrink-0 flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.5)" }}>
                  {parsing ? <><span className="inline-block animate-spin">⏳</span> Parsing…</> : <><Sparkles className="w-4 h-4" /> ✨ Auto-fill Profile</>}
                </button>
              </div>
              {parseMessage && (
                <div className={`mb-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${parseMessage.type === "success" ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20" : "text-rose-300 bg-rose-500/10 border border-rose-500/20"}`}>
                  {parseMessage.type === "success" ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <span>⚠</span>}{parseMessage.text}
                </div>
              )}
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all mb-4 ${dragging ? "border-indigo-400 bg-indigo-500/10" : form.resumeFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-600 hover:border-indigo-500/50"}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
                {form.resumeFile ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400"><CheckCircle className="w-5 h-5" /><span className="font-medium text-sm">{form.resumeFile.name}</span><button type="button" onClick={() => setForm(p => ({ ...p, resumeFile: null }))} className="text-slate-400 hover:text-rose-400 transition-colors ml-2"><X className="w-4 h-4" /></button></div>
                ) : (
                  <><Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" /><p className="text-slate-400 text-sm mb-1">Drag & drop your resume here</p><p className="text-slate-500 text-xs mb-3">PDF, DOCX, or TXT — up to 5MB</p><label className="btn-secondary text-sm cursor-pointer">Browse File<input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) extractAndSetFile(e.target.files[0]); }} /></label></>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2"><div className="flex-1 h-px bg-slate-700" /><span className="text-xs text-slate-500 font-medium px-2">or paste resume text</span><div className="flex-1 h-px bg-slate-700" /></div>
                <textarea className="input resize-none text-xs leading-relaxed font-mono" rows={6} placeholder="Paste your full resume here…" value={form.resumeText.startsWith("[Resume file:") ? "" : form.resumeText} onChange={e => setForm(p => ({ ...p, resumeText: e.target.value }))} />
                {form.resumeText && !form.resumeText.startsWith("[Resume file:") && <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {form.resumeText.length} chars — ready to auto-fill</p>}
              </div>
            </div>
            {!form.resumeFile && !form.resumeText.trim() && <p className="text-xs text-rose-400 text-center flex items-center justify-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Please upload or paste your resume to continue</p>}
            <button type="submit" disabled={!form.resumeFile && !form.resumeText.trim()} className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Sparkles className="w-5 h-5" /> Save Profile & Find Matches <ChevronRight className="w-5 h-5" />
            </button>
          </form>
        </>
      )}
    </>
  );
}

// ─── Tab 2: Resume & ATS ───────────────────────────────────────────────────────
function ResumeATSTab({ onTabChange }: { onTabChange: (t: TabId) => void }) {
  const { profile, loading } = useProfile();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [heatmapJd, setHeatmapJd] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState<{ pdf_base64?: string; docx_base64?: string; summary?: string } | null>(null);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  const generateMasterResume = async () => {
    if (!profile) return;
    setGenerating(true); setGenError(""); setGenResult(null);
    try {
      const res = await fetch(`${API}/api/resume/generate-master`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { name: profile.name, current_role: profile.currentRole, experience_years: profile.experienceYears, current_location: profile.currentLocation, work_mode: profile.workMode, skills: profile.skills, frameworks: profile.frameworks, languages: profile.languages, cicd_tools: profile.cicdTools, ai_tools: profile.aiTools, certifications: profile.certifications, base_resume_text: profile.resumeText } }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as Record<string, string>).detail || `Error ${res.status}`); }
      setGenResult(await res.json());
    } catch (e: unknown) { setGenError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setGenerating(false); }
  };

  const downloadFile = (b64: string, filename: string, mime: string) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const score = (() => {
    if (!profile) return 0;
    let pts = 0;
    if (profile.name?.trim())                pts += 12;
    if (profile.currentRole?.trim())         pts += 15;
    if (Number(profile.experienceYears) > 0) pts += 10;
    if (Number(profile.currentSalary) > 0)   pts += 5;
    if (profile.currentLocation?.trim())     pts += 8;
    if (profile.skills?.length >= 3)         pts += 15;
    if (profile.skills?.length >= 8)         pts += 10;
    if (profile.frameworks?.length > 0)      pts += 8;
    if (profile.cicdTools?.length > 0)       pts += 7;
    if (profile.certifications?.length > 0)  pts += 5;
    if (profile.resumeText?.trim())          pts += 5;
    return Math.min(pts, 100);
  })();
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";
  const scoreLabel = score >= 80 ? "Strong" : score >= 60 ? "Fair" : "Needs Work";

  const allProfileSkills = [...(profile?.skills ?? []), ...(profile?.frameworks ?? []), ...(profile?.cicdTools ?? []), ...(profile?.languages ?? [])];
  const resumeTextForHeatmap = heatmapJd ? (profile?.resumeText || "") + " " + heatmapJd : (profile?.resumeText || "");
  const heatmapData = calcKeywordHeatmap(resumeTextForHeatmap, allProfileSkills);
  const inResumeCount = heatmapData.filter(k => k.inResume || k.inProfile).length;
  const missingHigh = heatmapData.filter(k => !k.inResume && !k.inProfile && k.priority === "High");
  const coverageScore = Math.round((inResumeCount / heatmapData.length) * 100);

  if (!loading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4"><UserCircle2 className="w-8 h-8 text-indigo-400" /></div>
          <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
          <p className="text-slate-400 text-sm mb-6">Set up your career profile first — your master resume data will appear here automatically.</p>
          <button onClick={() => onTabChange("profile")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2"><FileOutput className="w-4 h-4" /> Base Resume Manager</div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your <span className="gradient-text">Master Profile</span></h1>
            <p className="text-slate-400 text-sm max-w-2xl">This is your master profile. When you view a job in the <strong className="text-white">Jobs Dashboard</strong>, AI generates a highly-targeted ATS resume by merging this data with the job description.</p>
          </div>
          <button onClick={() => onTabChange("match")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", border: "1px solid var(--border-hover)", color: "var(--accent-bright)" }}>
            <Target className="w-4 h-4" /> JD Match Studio
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Extracted Profile Data</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
              <div><p className="text-slate-500 mb-1">Name</p><p className="font-medium text-white">{profile?.name || "—"}</p></div>
              <div><p className="text-slate-500 mb-1">Current Role</p><p className="font-medium text-white">{profile?.currentRole || "—"}</p></div>
              <div><p className="text-slate-500 mb-1">Experience</p><p className="font-medium text-white">{profile?.experienceYears ? `${profile.experienceYears} Years` : "—"}</p></div>
              <div><p className="text-slate-500 mb-1">Location</p><p className="font-medium text-white">{profile?.currentLocation || "—"}</p></div>
            </div>
            <div className="space-y-4">
              {(profile?.skills ?? []).length > 0 && <div><h3 className="text-sm font-medium text-slate-300 mb-2">Core Skills</h3><div className="flex flex-wrap gap-1.5">{(profile?.skills ?? []).map(s => <span key={s} className="tag">{s}</span>)}</div></div>}
              {(profile?.frameworks ?? []).length > 0 && <div><h3 className="text-sm font-medium text-slate-300 mb-2">Frameworks</h3><div className="flex flex-wrap gap-1.5">{(profile?.frameworks ?? []).map(s => <span key={s} className="tag">{s}</span>)}</div></div>}
              {(profile?.cicdTools ?? []).length > 0 && <div><h3 className="text-sm font-medium text-slate-300 mb-2">CI/CD & DevOps</h3><div className="flex flex-wrap gap-1.5">{(profile?.cicdTools ?? []).map(s => <span key={s} className="tag">{s}</span>)}</div></div>}
              {profile?.resumeText && !profile.resumeText.startsWith("[Resume file:") && <div><h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Resume Text Loaded</h3><p className="text-xs text-slate-500 leading-relaxed line-clamp-3 bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 font-mono">{profile.resumeText.slice(0, 280)}…</p></div>}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-rose-400" /> ATS Keyword Coverage Heatmap</h2>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${coverageScore >= 60 ? "text-emerald-400" : coverageScore >= 40 ? "text-amber-400" : "text-rose-400"}`}>{coverageScore}% coverage</span>
                <button onClick={() => { setShowHeatmap(p => !p); setTimeout(() => jdRef.current?.focus(), 100); }} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {showHeatmap ? "Hide" : "Add JD"} to analyse
                </button>
              </div>
            </div>
            {showHeatmap && <div className="mb-4"><label className="text-xs font-medium text-slate-400 mb-1.5 block">Paste a Job Description to check keyword match against your resume</label><textarea ref={jdRef} className="input text-xs resize-none font-mono leading-relaxed" rows={4} placeholder="Paste the full job description here…" value={heatmapJd} onChange={e => setHeatmapJd(e.target.value)} /></div>}
            <div className="mb-4"><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${coverageScore}%`, background: coverageScore >= 60 ? "linear-gradient(90deg, #10b981, #34d399)" : coverageScore >= 40 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #f43f5e, #fb7185)" }} /></div></div>
            {missingHigh.length > 0 && <div className="mb-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl"><p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing High-Priority Keywords</p><div className="flex flex-wrap gap-1.5">{missingHigh.map(k => <span key={k.keyword} className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">{k.keyword}</span>)}</div><p className="text-[10px] text-slate-500 mt-2">Add these to improve ATS match by ~{missingHigh.length * 4}%</p></div>}
            <div className="flex flex-wrap gap-1.5">
              {heatmapData.map(k => {
                const present = k.inResume || k.inProfile;
                return <span key={k.keyword} title={present ? "✓ Found in your profile/resume" : "✗ Missing — add to improve ATS score"} className={`text-[11px] px-2 py-0.5 rounded-md border font-medium transition-all ${present ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" : k.priority === "High" ? "bg-rose-500/8 text-rose-400 border-rose-500/20" : k.priority === "Medium" ? "bg-amber-500/8 text-amber-500/80 border-amber-500/15" : "bg-slate-800/40 text-slate-600 border-slate-700/30"}`}>{present ? "✓" : "+"} {k.keyword}</span>;
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/50 inline-block" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/20 border border-rose-500/30 inline-block" /> Missing (High)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/15 border border-amber-500/20 inline-block" /> Missing (Medium)</span>
            </div>
          </div>
          <div className="card border-indigo-500/30 bg-indigo-500/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-indigo-400" /></div>
              <div><h3 className="text-base font-semibold text-white mb-1">How AI Resume Generation Works</h3><p className="text-sm text-slate-400 leading-relaxed mb-3">AI merges your master profile, uploaded resume text, and the target job description to rewrite your experience bullets using the exact ATS keywords the JD requires.</p><div className="flex items-center gap-1.5 text-xs text-indigo-400"><TrendingUp className="w-3.5 h-3.5" /><span>Profile + Resume + JD → ATS score 95%+</span></div></div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-6 text-center">Baseline ATS Score</h2>
            <div className="flex justify-center mb-3">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="absolute w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(18,26,56,0.9)" strokeWidth="8" />
                  <circle cx="64" cy="64" r="56" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={56 * 2 * Math.PI} strokeDashoffset={(56 * 2 * Math.PI) * (1 - score / 100)} className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="text-center"><span className="text-3xl font-bold" style={{ color: scoreColor }}>{score}</span><p className="text-[10px] font-semibold mt-0.5" style={{ color: scoreColor }}>{scoreLabel}</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs"><ShieldAlert className="w-4 h-4 shrink-0" style={{ color: scoreColor }} /><p className="text-slate-300">Base profile scores <strong className="text-white">{score}%</strong> against generic roles.</p></div>
              <div className="flex items-start gap-2 text-xs"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /><p className="text-slate-300">AI-generated per-job resumes push match to <strong className="text-white">95%+</strong>.</p></div>
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4">Profile Completeness</h2>
            <div className="space-y-2">
              {[
                { label: "Full Name", done: !!profile?.name?.trim() },
                { label: "Current Role", done: !!profile?.currentRole?.trim() },
                { label: "Experience Years", done: Number(profile?.experienceYears) > 0 },
                { label: "Location", done: !!profile?.currentLocation?.trim() },
                { label: "Skills (3+)", done: (profile?.skills?.length ?? 0) >= 3 },
                { label: "Skills (8+)", done: (profile?.skills?.length ?? 0) >= 8 },
                { label: "Resume Text", done: !!(profile?.resumeText?.trim() && !profile.resumeText.startsWith("[Resume file:")) },
                { label: "Certifications", done: (profile?.certifications?.length ?? 0) > 0 },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-slate-700/50 border border-slate-600"}`}>{done && <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />}</div>
                  <span className={done ? "text-slate-300" : "text-slate-500"}>{label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onTabChange("profile")} className="btn-secondary w-full mt-4 text-xs py-2">Edit Profile</button>
          </div>
          <div className="card" style={{ border: "1px solid rgba(99,102,241,0.3)", background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))" }}>
            <div className="flex items-center gap-2 mb-1"><Download className="w-4 h-4" style={{ color: "var(--accent-bright)" }} /><h2 className="text-sm font-semibold text-white">Download Master ATS Resume</h2></div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">Merges your full profile + uploaded resume into a polished ATS-ready document using AI.</p>
            {!genResult ? (
              <button onClick={generateMasterResume} disabled={generating || !profile?.name} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all" style={{ background: generating ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, var(--accent-deep), var(--accent))", opacity: generating || !profile?.name ? 0.6 : 1, boxShadow: generating ? "none" : "0 4px 14px -4px var(--glow-accent)" }}>
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate & Download</>}
              </button>
            ) : (
              <div className="space-y-2">
                {genResult.summary && <div className="rounded-xl p-3 mb-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}><p className="text-xs font-semibold text-slate-400 mb-1">AI-Written Summary</p><p className="text-xs text-slate-300 leading-relaxed">{genResult.summary}</p></div>}
                <div className="flex gap-2">
                  {genResult.pdf_base64 && <button onClick={() => downloadFile(genResult!.pdf_base64!, `${profile?.name?.replace(/\s+/g, "_") || "resume"}_ATS.pdf`, "application/pdf")} className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}><Download className="w-3.5 h-3.5" /> PDF</button>}
                  {genResult.docx_base64 && <button onClick={() => downloadFile(genResult!.docx_base64!, `${profile?.name?.replace(/\s+/g, "_") || "resume"}_ATS.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")} className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}><Download className="w-3.5 h-3.5" /> DOCX</button>}
                </div>
                <button onClick={generateMasterResume} disabled={generating} className="w-full py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1" style={{ background: "var(--bg-elevated)" }}>
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Regenerate
                </button>
              </div>
            )}
            {genError && <div className="mt-3 rounded-xl p-3 text-xs text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>{genError}</div>}
            {!profile?.name && <p className="text-xs text-slate-500 mt-2 text-center">Save your profile first to enable this.</p>}
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4">Update Source Document</h2>
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-slate-700/60 hover:border-indigo-500/40"}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}>
              {file ? (
                <div className="text-emerald-400 text-sm font-medium flex flex-col items-center"><CheckCircle className="w-6 h-6 mb-2" />{file.name}</div>
              ) : (
                <><Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" /><p className="text-xs text-slate-400 mb-2">Drag & drop new resume</p><label className="btn-secondary text-xs cursor-pointer py-1.5 px-3">Browse<input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} /></label></>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab 3: JD Match Studio ───────────────────────────────────────────────────
function JDMatchTab({ onTabChange }: { onTabChange: (t: TabId) => void }) {
  const { profile, loading } = useProfile();
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [showJdHighlight, setShowJdHighlight] = useState(true);
  const [showResumeHighlight, setShowResumeHighlight] = useState(true);
  const [filterMissing, setFilterMissing] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  const profileResume = profile?.resumeText ?? "";

  const handleAnalyze = () => { if (!jdText.trim() || !resumeText.trim()) return; setAnalyzed(true); setSuggestions([]); };

  const keywords = useMemo(() => { if (!analyzed || !jdText || !resumeText) return []; return analyzeKeywords(jdText, resumeText); }, [analyzed, jdText, resumeText]);
  const matchStats = useMemo(() => calcMatchScore(keywords), [keywords]);
  const displayKeywords = useMemo(() => filterMissing ? keywords.filter(k => !k.inResume) : keywords, [keywords, filterMissing]);
  const visibleKeywords = expandedTerms ? displayKeywords : displayKeywords.slice(0, 20);
  const jdHighlighted = useMemo(() => { if (!analyzed || !showJdHighlight) return null; return highlightText(jdText, keywords.filter(k => k.inResume), "jd"); }, [analyzed, showJdHighlight, jdText, keywords]);
  const resumeHighlighted = useMemo(() => { if (!analyzed || !showResumeHighlight) return null; return highlightText(resumeText, keywords, "resume"); }, [analyzed, showResumeHighlight, resumeText, keywords]);

  const generateSuggestions = async () => {
    if (!jdText || !resumeText) return;
    setGenerating(true); setSuggestions([]);
    try {
      const res = await fetch(`${API}/api/resume/generate-ats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: profile ?? {}, job: { title: "Target Role", description: jdText.slice(0, 1500) }, gap_keywords: matchStats.missing }) });
      if (res.ok) { const data = await res.json(); setSuggestions((data.bullets ?? data.ats_bullets ?? []).slice(0, 5)); }
    } catch { /* silent */ }
    setGenerating(false);
  };

  const copyMissing = () => { navigator.clipboard.writeText(matchStats.missing.join(", ")); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const scoreColor = matchStats.score >= 75 ? "text-emerald-400" : matchStats.score >= 55 ? "text-amber-400" : "text-rose-400";
  const scoreLabel = matchStats.score >= 75 ? "Strong Match" : matchStats.score >= 55 ? "Partial Match" : "Weak Match";

  if (!loading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center max-w-sm">
          <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-white font-semibold text-xl mb-2">No profile found</h2>
          <p className="text-slate-400 text-sm mb-6">Set up your career profile first.</p>
          <button onClick={() => onTabChange("profile")} className="btn-primary text-sm px-6 py-2.5">Set Up Profile</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => onTabChange("resume")} className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1"><FileText className="w-3.5 h-3.5" /> Resume Studio</div>
          <h1 className="text-2xl font-bold text-white">JD <span className="gradient-text">Match Studio</span></h1>
        </div>
        {analyzed && (
          <div className="ml-auto flex items-center gap-2">
            <div className={`text-3xl font-bold ${scoreColor}`}>{matchStats.score}%</div>
            <div><p className={`text-xs font-semibold ${scoreColor}`}>{scoreLabel}</p><p className="text-[10px] text-slate-500">keyword match</p></div>
          </div>
        )}
      </div>
      {!analyzed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div className="card p-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2"><Target className="w-3.5 h-3.5 text-indigo-400" /> Job Description</label>
            <textarea ref={jdRef} className="input w-full resize-none text-xs leading-relaxed" rows={14} placeholder="Paste the full job description here…" value={jdText} onChange={e => setJdText(e.target.value)} />
            <p className="text-[10px] text-slate-500 mt-1">{jdText.split(/\s+/).filter(Boolean).length} words</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-cyan-400" /> Your Resume</label>
              {profileResume && <button onClick={() => setResumeText(profileResume)} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Load from profile</button>}
            </div>
            <textarea className="input w-full resize-none text-xs leading-relaxed" rows={14} placeholder="Paste your resume text here…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
            <p className="text-[10px] text-slate-500 mt-1">{resumeText.split(/\s+/).filter(Boolean).length} words</p>
          </div>
        </div>
      )}
      {!analyzed ? (
        <button onClick={handleAnalyze} disabled={!jdText.trim() || !resumeText.trim()} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mb-6 disabled:opacity-40">
          <Sparkles className="w-5 h-5" /> Analyze Match
        </button>
      ) : (
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setAnalyzed(false); setSuggestions([]); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-xl" style={{ border: "1px solid var(--border)" }}><RefreshCw className="w-3.5 h-3.5" /> Edit Inputs</button>
          <button onClick={generateSuggestions} disabled={generating} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}{generating ? "Generating…" : "AI Bullet Suggestions"}
          </button>
        </div>
      )}
      {analyzed && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Match Score", value: `${matchStats.score}%`, color: scoreColor },
              { label: "Critical Hits", value: `${matchStats.critical}/${keywords.filter(k => k.priority === "critical").length}`, color: matchStats.critical >= keywords.filter(k => k.priority === "critical").length * 0.7 ? "text-emerald-400" : "text-rose-400" },
              { label: "Important Hits", value: `${matchStats.important}/${keywords.filter(k => k.priority === "important").length}`, color: "text-cyan-400" },
              { label: "Missing Keywords", value: matchStats.missing.length.toString(), color: matchStats.missing.length === 0 ? "text-emerald-400" : "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4 text-center"><p className={`text-2xl font-bold ${color} mb-0.5`}>{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>
            ))}
          </div>
          {matchStats.missing.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-400" /> Missing from Resume <span className="text-xs text-slate-500 font-normal">— add these to improve your match</span></h3>
                <button onClick={copyMissing} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">{copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy all</>}</button>
              </div>
              <div className="flex flex-wrap gap-2">{matchStats.missing.map(term => <span key={term} className="text-xs px-2.5 py-1 rounded-full font-medium border" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af" }}>{term}</span>)}</div>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> AI-Generated Bullets <span className="text-xs text-slate-500 font-normal">— ready to drop into your resume</span></h3>
              <ol className="space-y-2">{suggestions.map((bullet, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed"><span className="text-indigo-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>{bullet}</li>)}</ol>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" /> Resume match (critical)</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/15 border border-blue-500/40" /> Resume match (important)</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/15 border border-rose-500/30" /> Missing keyword</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-indigo-400" /> Job Description</h3><button onClick={() => setShowJdHighlight(h => !h)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors">{showJdHighlight ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{showJdHighlight ? "Hide" : "Show"} highlights</button></div>
              <div className="text-xs leading-relaxed text-slate-300 max-h-[500px] overflow-y-auto pr-2 whitespace-pre-wrap" style={{ scrollbarWidth: "thin" }}>{showJdHighlight && jdHighlighted ? jdHighlighted : jdText}</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-cyan-400" /> Your Resume</h3><button onClick={() => setShowResumeHighlight(h => !h)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors">{showResumeHighlight ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{showResumeHighlight ? "Hide" : "Show"} highlights</button></div>
              <div className="text-xs leading-relaxed text-slate-300 max-h-[500px] overflow-y-auto pr-2 whitespace-pre-wrap" style={{ scrollbarWidth: "thin" }}>{showResumeHighlight && resumeHighlighted ? resumeHighlighted : resumeText}</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-400" /> Keyword Analysis</h3>
              <button onClick={() => setFilterMissing(f => !f)} className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${filterMissing ? "text-rose-400 border-rose-500/40 bg-rose-500/10" : "text-slate-400 border-slate-600"}`}>{filterMissing ? "Showing missing only" : "Show missing only"}</button>
            </div>
            <div className="divide-y divide-slate-700/40">
              {visibleKeywords.map(kw => (
                <div key={kw.term} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0"><span className="text-xs text-slate-300 font-medium truncate">{kw.term}</span></div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${kw.priority === "critical" ? "bg-rose-500/15 text-rose-300" : kw.priority === "important" ? "bg-amber-500/15 text-amber-300" : "bg-slate-600/30 text-slate-400"}`}>{kw.priority}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 w-10 text-right">×{kw.jdFreq} in JD</span>
                  <div className="shrink-0">{kw.inResume ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}</div>
                </div>
              ))}
            </div>
            {displayKeywords.length > 20 && (
              <button onClick={() => setExpandedTerms(e => !e)} className="w-full mt-3 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 py-2 transition-colors">
                {expandedTerms ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {displayKeywords.length} keywords</>}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main merged page ─────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "profile", label: "Profile",      icon: User,     desc: "Edit your career profile & skills"     },
  { id: "resume",  label: "Resume & ATS", icon: FileText, desc: "ATS heatmap & master resume download"  },
  { id: "match",   label: "JD Match",     icon: Target,   desc: "Analyse a job description keyword match" },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (tab && ["profile", "resume", "match"].includes(tab)) setActiveTab(tab);
  }, []);

  return (
    <div className="flex min-h-screen bg-transparent">
      <main className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-6 pb-8 max-w-6xl">
        {/* Unified tab strip */}
        <div className="mb-6">
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.desc}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={active ? {
                    background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                    color: "var(--accent-bright)",
                    border: "1px solid var(--border-hover)",
                    boxShadow: "0 0 12px -4px var(--glow-accent)",
                  } : { color: "#94a3b8", border: "1px solid transparent" }}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2 ml-1">{TABS.find(t => t.id === activeTab)?.desc}</p>
        </div>

        {activeTab === "profile" && <ProfileTab onTabChange={setActiveTab} />}
        {activeTab === "resume"  && <ResumeATSTab onTabChange={setActiveTab} />}
        {activeTab === "match"   && <JDMatchTab onTabChange={setActiveTab} />}
      </main>
    </div>
  );
}
