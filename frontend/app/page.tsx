"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { saveProfile, loadProfile } from "@/lib/profile";
import {
  User, Briefcase, DollarSign, MapPin, Clock,
  Plus, X, Upload, ChevronRight, Sparkles, CheckCircle,
  TrendingUp, Award, Zap
} from "lucide-react";
import LocationAutocomplete from "@/components/LocationAutocomplete";

const SKILL_CATEGORIES: Record<string, string[]> = {
  "Frontend": [
    "React", "Next.js", "Vue.js", "Angular", "Svelte", "TypeScript", "JavaScript",
    "HTML/CSS", "Tailwind CSS", "Redux", "Zustand", "Webpack", "Vite", "Storybook",
    "Accessibility (a11y)", "Web Performance", "PWA", "Three.js", "D3.js",
  ],
  "Backend": [
    "Node.js", "Python", "Java", "Go", "Rust", "C++", "C#", ".NET", "Spring Boot",
    "FastAPI", "Django", "Flask", "Express", "NestJS", "Ruby on Rails", "PHP", "Laravel",
    "Elixir", "Phoenix", "Scala", "Akka",
  ],
  "Mobile": [
    "React Native", "Flutter", "Swift", "Kotlin", "Android", "iOS",
    "Expo", "Jetpack Compose", "SwiftUI", "Xamarin", "Capacitor",
  ],
  "Data & AI/ML": [
    "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Keras",
    "Scikit-learn", "Pandas", "NumPy", "Spark", "Kafka", "Flink", "Airflow",
    "dbt", "NLP", "LLMs", "RAG", "LangChain", "Hugging Face", "MLflow",
    "Data Pipelines", "Feature Engineering", "A/B Testing", "Statistics",
  ],
  "Cloud & DevOps": [
    // Cloud Platforms
    "AWS", "Azure", "GCP", "Oracle Cloud (OCI)", "IBM Cloud",
    // Containers & Orchestration
    "Docker", "Kubernetes", "Helm", "ArgoCD", "Flux CD", "Kustomize",
    "OpenShift", "Rancher", "Docker Compose", "Podman",
    // IaC & Configuration Management
    "Terraform", "Pulumi", "Ansible", "Chef", "Puppet", "SaltStack",
    "AWS CloudFormation", "AWS CDK", "Crossplane",
    // CI/CD Pipelines
    "GitHub Actions", "GitLab CI/CD", "Jenkins", "Azure DevOps Pipelines",
    "CircleCI", "TeamCity", "Bamboo", "Bitbucket Pipelines", "Tekton",
    "Drone CI", "Travis CI", "AWS CodePipeline", "AWS CodeBuild",
    // Service Mesh & Networking
    "Istio", "Linkerd", "Envoy Proxy", "NGINX", "HAProxy", "Traefik",
    // Observability & Monitoring
    "Prometheus", "Grafana", "Datadog", "New Relic", "Dynatrace",
    "ELK Stack (Elasticsearch, Logstash, Kibana)", "Splunk", "Jaeger",
    "Zipkin", "OpenTelemetry", "CloudWatch", "Azure Monitor",
    // DevSecOps
    "SonarQube", "Trivy", "Snyk", "OWASP ZAP", "HashiCorp Vault",
    "Falco", "SAST", "DAST", "Aqua Security", "Checkov",
    // Other
    "Linux", "Bash/Shell Scripting", "KEDA", "Cert-Manager",
    "Site Reliability Engineering", "GitOps", "Platform Engineering",
    "Blue-Green Deployment", "Canary Releases", "Feature Flags",
  ],
  "B2B Integration": [
    // webMethods Platform (Software AG)
    "webMethods Integration Server", "webMethods.IO Integration",
    "webMethods.IO B2B", "webMethods Trading Networks",
    "webMethods BPM / Process Engine", "webMethods Designer (Eclipse IDE)",
    "webMethods Flow Services", "webMethods Universal Messaging",
    "webMethods Mediator", "webMethods API Gateway",
    "webMethods API Portal", "webMethods CloudStreams",
    "webMethods ActiveTransfer", "webMethods Broker",
    "webMethods Optimize / BAM", "webMethods CAF",
    "webMethods Document Types", "webMethods JDBC Adapter",
    "webMethods SAP Adapter", "webMethods Flat File Schema",
    // EDI & Standards
    "EDI X12", "EDIFACT", "RosettaNet (RNIF)", "AS2 (EDIINT)",
    "AS4", "SFTP/FTP/FTPS", "HL7", "HIPAA EDI", "ANSI X12 850/855/856/810",
    "XML/JSON Mapping", "XSLT", "ebXML", "SWIFT",
    // Other Integration Platforms
    "MuleSoft Anypoint Platform", "Dell Boomi AtomSphere",
    "IBM Sterling B2B Integrator", "IBM MQ", "IBM DataPower Gateway",
    "IBM App Connect Enterprise (ACE/IIB)",
    "TIBCO BusinessWorks", "TIBCO EMS",
    "SAP Integration Suite (CPI/BTP)", "SAP PI/PO",
    "Axway AMPLIFY / B2Bi", "Informatica PowerCenter",
    "Informatica IICS", "OpenText Business Network",
    "Cleo Integration Cloud", "Jitterbit", "SnapLogic",
    // BPM & Workflow
    "BPMN 2.0", "Business Process Modelling", "Process Automation",
    "Camunda BPM", "IBM Business Automation Workflow (BAW)",
    "Pega BPM", "Appian", "ServiceNow Integration Hub",
    // Protocols & Formats
    "SOAP/WSDL", "REST APIs", "GraphQL", "JSON", "XML",
    "FIX Protocol", "OData", "JDBC/ODBC",
  ],
  "API Management": [
    // Gateways & Platforms
    "webMethods API Gateway", "webMethods API Portal",
    "Kong Gateway", "Kong Konnect", "AWS API Gateway",
    "Azure API Management (APIM)", "Google Apigee", "Apigee X",
    "MuleSoft API Manager", "IBM API Connect",
    "Axway Amplify API Management", "WSO2 API Manager",
    "3scale (Red Hat)", "Tyk Gateway",
    // API Design & Standards
    "OpenAPI 3.x / Swagger", "API-first Design",
    "API Versioning", "Rate Limiting", "Throttling", "SLA Policies",
    "OAuth 2.0", "JWT", "API Keys", "mTLS",
    "API Security (OWASP API Top 10)", "GraphQL APIs",
    // Testing & Monitoring
    "Postman", "Newman", "Insomnia", "SoapUI",
    "API Contract Testing", "API Mock Servers", "WireMock",
    "API Analytics", "API Monitoring",
  ],
  "Databases": [
    // Relational
    "PostgreSQL", "MySQL", "Oracle Database", "SQL Server (MSSQL)",
    "IBM DB2", "MariaDB", "SQLite", "CockroachDB",
    // NoSQL - Document
    "MongoDB", "CouchDB", "Amazon DocumentDB", "Firestore",
    // NoSQL - Key-Value / Cache
    "Redis", "Memcached", "DynamoDB", "Azure Cosmos DB", "Hazelcast",
    // NoSQL - Wide Column
    "Apache Cassandra", "HBase", "Google Bigtable",
    // Graph
    "Neo4j", "Amazon Neptune", "ArangoDB", "TigerGraph",
    // Time Series
    "InfluxDB", "TimescaleDB", "OpenTSDB", "Prometheus (metrics store)",
    // Search
    "Elasticsearch", "OpenSearch", "Apache Solr",
    // Data Warehouse / OLAP
    "Snowflake", "Google BigQuery", "Amazon Redshift",
    "Azure Synapse Analytics", "Databricks Lakehouse",
    "ClickHouse", "Apache Druid", "Greenplum",
    // Skills & Concepts
    "SQL Query Optimisation", "Database Design / ERD", "Indexing Strategies",
    "Stored Procedures", "Views & Triggers", "Partitioning & Sharding",
    "Replication & High Availability", "Database Migration",
    "JDBC / ODBC", "Connection Pooling", "Prisma", "Sequelize",
    "Vector Databases (pgvector, Pinecone, Weaviate)",
  ],
  "Testing & QA": [
    "Selenium", "Playwright", "Cypress", "Jest", "Vitest", "Pytest", "JUnit",
    "TestNG", "Mocha", "Chai", "Postman", "JMeter", "K6", "Gatling",
    "Appium", "REST Assured", "Contract Testing", "Pact", "BDD/Cucumber",
    "Load Testing", "Chaos Engineering",
  ],
  "Architecture & Design": [
    "System Design", "Microservices", "Event-Driven Architecture", "CQRS",
    "Domain-Driven Design", "REST APIs", "gRPC", "GraphQL APIs", "OpenAPI",
    "Message Queues", "RabbitMQ", "NATS", "WebSockets", "OAuth 2.0", "JWT",
  ],
  "Tools & Practices": [
    "Git", "GitHub", "GitLab", "JIRA", "Confluence", "Figma", "Notion",
    "Agile/Scrum", "Kanban", "Code Review", "Technical Writing",
    "Pair Programming", "Trunk-Based Development", "Feature Flags",
  ],
};

// Return skill categories ordered by relevance to the entered role
function getOrderedCategories(role: string): [string, string[]][] {
  const r = role.toLowerCase();
  const all = Object.entries(SKILL_CATEGORIES);
  const priorities: Record<string, number> = {};

  if (/front.?end|ui engineer|react dev|vue|angular|web dev/i.test(r)) {
    Object.assign(priorities, { "Frontend": 10, "Architecture & Design": 8, "Testing & QA": 7, "Backend": 6, "Tools & Practices": 5 });
  } else if (/back.?end|api|server|micro.?service|node|java|spring|django|fastapi|flask/i.test(r)) {
    Object.assign(priorities, { "Backend": 10, "Databases": 9, "Architecture & Design": 8, "Cloud & DevOps": 7, "Testing & QA": 5 });
  } else if (/full.?stack/i.test(r)) {
    Object.assign(priorities, { "Frontend": 10, "Backend": 10, "Databases": 8, "Architecture & Design": 7, "Cloud & DevOps": 6, "Testing & QA": 5 });
  } else if (/mobile|ios|android|flutter|react native/i.test(r)) {
    Object.assign(priorities, { "Mobile": 10, "Backend": 7, "Architecture & Design": 6, "Testing & QA": 5, "Cloud & DevOps": 4 });
  } else if (/data engineer|data pipeline|analytics engineer|etl/i.test(r)) {
    Object.assign(priorities, { "Data & AI/ML": 10, "Databases": 10, "Cloud & DevOps": 8, "Backend": 6, "Tools & Practices": 5 });
  } else if (/machine learning|ml engineer|data scientist|ai engineer|nlp|deep learning|research/i.test(r)) {
    Object.assign(priorities, { "Data & AI/ML": 10, "Databases": 7, "Cloud & DevOps": 7, "Backend": 5, "Architecture & Design": 5 });
  } else if (/devops|sre|platform|infra|cloud engineer|reliability|kubernetes|terraform|cicd|ci\/cd|pipeline/i.test(r)) {
    Object.assign(priorities, { "Cloud & DevOps": 10, "Architecture & Design": 8, "Databases": 6, "Backend": 5, "Tools & Practices": 5 });
  } else if (/qa|quality|test|sdet|automation.*test|test.*automation/i.test(r)) {
    Object.assign(priorities, { "Testing & QA": 10, "Architecture & Design": 7, "Backend": 7, "Cloud & DevOps": 6, "Tools & Practices": 5 });
  } else if (/b2b|integration|webmethod|trading network|edi|bpm|mulesoft|boomi|tibco|sterling|api gateway|middleware|ipaas/i.test(r)) {
    Object.assign(priorities, { "B2B Integration": 10, "API Management": 9, "Databases": 7, "Architecture & Design": 8, "Cloud & DevOps": 5, "Tools & Practices": 4 });
  } else if (/api management|api manager|api platform|kong|apigee|apim/i.test(r)) {
    Object.assign(priorities, { "API Management": 10, "B2B Integration": 8, "Architecture & Design": 9, "Cloud & DevOps": 6, "Backend": 5 });
  } else if (/database|dba|data engineer|sql|nosql|postgres|oracle dba/i.test(r)) {
    Object.assign(priorities, { "Databases": 10, "Data & AI/ML": 8, "Backend": 7, "Cloud & DevOps": 6, "Architecture & Design": 5 });
  } else if (/security|cyber|pentest|appsec/i.test(r)) {
    Object.assign(priorities, { "Cloud & DevOps": 10, "Architecture & Design": 9, "Backend": 8, "Databases": 6, "Tools & Practices": 5 });
  } else if (/architect|principal|staff|tech lead/i.test(r)) {
    Object.assign(priorities, { "Architecture & Design": 10, "Backend": 8, "Cloud & DevOps": 8, "Databases": 7, "Frontend": 5, "Tools & Practices": 6 });
  }

  return all.sort(([a], [b]) => (priorities[b] ?? 0) - (priorities[a] ?? 0));
}
const ALL_SKILLS = Object.values(SKILL_CATEGORIES).flat();

function calcCompleteness(form: {
  name: string; currentRole: string; currentSalary: string;
  experienceYears: string; currentLocation: string;
  skills: string[]; workMode: string; preferredLocations: string[];
  resumeFile: File | null; resumeText: string;
}): number {
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
  if (form.resumeFile || form.resumeText.trim()) pts += 12; // mandatory — worth 12 pts
  if (form.resumeText.trim().length > 200)      pts += 10; // rich resume text
  return Math.min(pts, 100);
}

function calcCareerScore(form: {
  name: string; currentRole: string; currentSalary: string;
  experienceYears: string; currentLocation: string;
  skills: string[]; frameworks: string[]; languages: string[]; cicdTools: string[];
  certifications: string[]; preferredLocations: string[];
  resumeFile: File | null; resumeText: string;
}): { total: number; breakdown: { label: string; score: number; max: number; color: string }[] } {
  const skillsTotal = form.skills.length + form.frameworks.length + form.languages.length + form.cicdTools.length;
  const skillsScore = Math.min(35, Math.round((skillsTotal / 20) * 35));
  const expYears = Number(form.experienceYears);
  const expScore = expYears >= 8 ? 20 : expYears >= 4 ? 16 : expYears >= 2 ? 12 : expYears >= 1 ? 8 : 0;
  const profileScore =
    (form.name.trim() ? 4 : 0) +
    (form.currentRole.trim() ? 4 : 0) +
    (form.currentLocation.trim() ? 4 : 0) +
    (form.preferredLocations.length > 0 ? 3 : 0);
  const resumeScore =
    (form.resumeFile ? 8 : 0) +
    (form.resumeText.trim().length > 500 ? 12 : form.resumeText.trim().length > 100 ? 8 : form.resumeText.trim() ? 4 : 0) +
    (form.certifications.length > 0 ? 5 : 0);
  const total = Math.min(100, skillsScore + expScore + profileScore + resumeScore);
  return {
    total,
    breakdown: [
      { label: "Skills & Tech", score: skillsScore, max: 35, color: "#6366f1" },
      { label: "Experience", score: expScore, max: 20, color: "#06b6d4" },
      { label: "Profile Info", score: profileScore, max: 15, color: "#a78bfa" },
      { label: "Resume & Certs", score: resumeScore, max: 30, color: "#10b981" },
    ],
  };
}

const DEFAULT_FORM = {
  name: "",
  currentRole: "",
  currentSalary: "",
  currency: "USD",
  experienceYears: "",
  workMode: "Any",
  currentLocation: "",
  preferredLocations: [] as string[],
  preferredLocation: "", // temp input buffer — not saved to profile
  skills: [] as string[],
  frameworks: [] as string[],
  languages: [] as string[],
  cicdTools: [] as string[],
  certifications: [] as string[],
  resumeText: "",  // saved to profile — extracted from file or pasted
  resumeFile: null as File | null, // transient — not saved to profile
};

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

  // Load persisted profile on mount (useEffect, not useState)
  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      setForm((p) => ({
        ...p,
        name: saved.name ?? "",
        currentRole: saved.currentRole ?? "",
        currentSalary: saved.currentSalary ? String(saved.currentSalary) : "",
        currency: saved.currency ?? "USD",
        experienceYears: saved.experienceYears ? String(saved.experienceYears) : "",
        workMode: saved.workMode ?? "Any",
        currentLocation: saved.currentLocation ?? "",
        preferredLocations: saved.preferredLocations ?? [],
        skills: saved.skills ?? [],
        frameworks: saved.frameworks ?? [],
        languages: saved.languages ?? [],
        cicdTools: saved.cicdTools ?? [],
        certifications: saved.certifications ?? [],
        resumeText: saved.resumeText ?? "",
      }));
    }
  }, []);

  const addSkill = (skill: string) => {
    if (!form.skills.includes(skill))
      setForm((p) => ({ ...p, skills: [...p.skills, skill] }));
  };
  const removeSkill = (skill: string) =>
    setForm((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }));

  const addLocation = () => {
    const loc = form.preferredLocation.trim();
    if (loc && !form.preferredLocations.includes(loc)) {
      setForm((p) => ({
        ...p,
        preferredLocations: [...p.preferredLocations, loc],
        preferredLocation: "",
      }));
    }
  };

  const extractAndSetFile = (f: File) => {
    setForm((p) => ({ ...p, resumeFile: f }));
    // Extract text for .txt files; for PDF/DOCX store a marker until server parses it
    if (f.type === "text/plain" || f.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text) setForm((p) => ({ ...p, resumeText: text.slice(0, 8000) }));
      };
      reader.readAsText(f);
    } else {
      // For PDF/DOCX mark it as uploaded; text extraction happens server-side
      setForm((p) => ({ ...p, resumeText: p.resumeText || `[Resume file: ${f.name}]` }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) extractAndSetFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate resume is provided
    if (!form.resumeFile && !form.resumeText.trim()) {
      document.getElementById("resume-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    // Save only typed profile fields — strip transient UI state
    saveProfile({
      name: form.name,
      currentRole: form.currentRole,
      currentSalary: Number(form.currentSalary) || 0,
      currency: form.currency,
      experienceYears: Number(form.experienceYears) || 0,
      workMode: form.workMode,
      currentLocation: form.currentLocation,
      preferredLocations: form.preferredLocations,
      skills: form.skills,
      frameworks: form.frameworks,
      languages: form.languages,
      cicdTools: form.cicdTools,
      certifications: form.certifications,
      resumeText: form.resumeText,
    });
    setSubmitted(true);
    setTimeout(() => router.push("/jobs"), 1200);
  };

  const filteredSkills = ALL_SKILLS.filter(
    (s) =>
      s.toLowerCase().includes(skillSearch.toLowerCase()) &&
      !form.skills.includes(s)
  );

  return (
    <div className="flex min-h-screen bg-transparent">
      <Navbar />
      <main className="md:ml-64 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-8 max-w-5xl">
        {/* Hero header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" /> AI-Powered Career Uplift Engine
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Tell us about your <span className="gradient-text">career profile</span>
          </h1>
          <p className="text-slate-400 text-base">
            We&apos;ll find verified jobs at the{" "}
            <span className="text-indigo-300 font-medium">same level with higher salary</span>{" "}
            or{" "}
            <span className="text-emerald-300 font-medium">next career level</span>{" "}
            you&apos;re ready for — and generate tailored ATS resumes, cover letters, and recruiter emails for each.
          </p>
        </div>

        {submitted ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Profile Saved!</h2>
            <p className="text-slate-400">Finding your best job matches…</p>
          </div>
        ) : (
          <>
            {/* Profile completeness bar */}
            {(() => {
              const pct = calcCompleteness(form);
              const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-indigo-500" : "bg-amber-500";
              const label = pct >= 80 ? "Great profile!" : pct >= 50 ? "Keep going" : "Just started";
              return (
                <div className="card py-3 px-4 mb-2 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-400">Profile Completeness</span>
                      <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-indigo-400" : "text-amber-400"}`}>
                        {pct}% — {label}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
                      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}
          {/* Career Score Widget */}
          {(() => {
            const cs = calcCareerScore(form);
            const level = cs.total >= 80 ? "Expert" : cs.total >= 60 ? "Advanced" : cs.total >= 35 ? "Intermediate" : "Beginner";
            const levelColor = cs.total >= 80 ? "text-emerald-400" : cs.total >= 60 ? "text-indigo-400" : cs.total >= 35 ? "text-amber-400" : "text-rose-400";
            const ringColor = cs.total >= 80 ? "#10b981" : cs.total >= 60 ? "#6366f1" : cs.total >= 35 ? "#f59e0b" : "#f43f5e";
            const circ = 2 * Math.PI * 28;
            const fill = (cs.total / 100) * circ;
            return (
              <div className="card py-4 px-4 mb-2">
                <div className="flex items-center gap-5">
                  {/* Score Ring */}
                  <div className="relative shrink-0">
                    <svg width="72" height="72" className="-rotate-90">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="6" />
                      <circle cx="36" cy="36" r="28" fill="none"
                        stroke={ringColor} strokeWidth="6"
                        strokeDasharray={circ}
                        strokeDashoffset={circ - fill}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold" style={{ color: ringColor }}>{cs.total}</span>
                      <span className="text-[9px] text-slate-500 leading-none">/ 100</span>
                    </div>
                  </div>

                  {/* Score Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-white">Career Score</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 ${levelColor}`}>
                        {level}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                      {cs.breakdown.map(({ label, score, max, color }) => (
                        <div key={label}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-slate-500">{label}</span>
                            <span style={{ color }}>{score}/{max}</span>
                          </div>
                          <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(score / max) * 100}%`, background: color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick tips */}
                  {cs.total < 80 && (
                    <div className="hidden lg:flex flex-col gap-1 shrink-0 max-w-[140px]">
                      <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold mb-1">
                        <Zap className="w-3 h-3" /> Boost tips
                      </div>
                      {cs.breakdown.filter(b => b.score < b.max).slice(0, 2).map(b => (
                        <div key={b.label} className="flex items-start gap-1 text-[10px] text-slate-400">
                          <TrendingUp className="w-3 h-3 mt-0.5 shrink-0 text-violet-400" />
                          <span>Add more {b.label.toLowerCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Personal Info */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    className="input"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Role</label>
                  <input
                    className="input"
                    placeholder="e.g. Software Engineer, Product Manager"
                    value={form.currentRole}
                    onChange={(e) => setForm((p) => ({ ...p, currentRole: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Career Details */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" /> Career Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    <DollarSign className="w-3 h-3 inline mr-0.5" /> Current Salary
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="input w-20! shrink-0"
                      value={form.currency}
                      onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                    >
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="AUD">AUD</option>
                    </select>
                    <input
                      className="input flex-1 min-w-0"
                      type="number"
                      placeholder="e.g. 80000"
                      value={form.currentSalary}
                      onChange={(e) => setForm((p) => ({ ...p, currentSalary: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-0.5" /> Relevant Experience (years)
                  </label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 5"
                    value={form.experienceYears}
                    onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Work Mode</label>
                  <select
                    className="input"
                    value={form.workMode}
                    onChange={(e) => setForm((p) => ({ ...p, workMode: e.target.value }))}
                  >
                    <option value="Any">Any</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Location */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-400" /> Location Preferences
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Location</label>
                  <LocationAutocomplete
                    value={form.currentLocation}
                    onChange={(v) => setForm((p) => ({ ...p, currentLocation: v }))}
                    placeholder="e.g. Bangalore, India"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Job Locations</label>
                  <div className="flex gap-2 mb-2">
                    <LocationAutocomplete
                      value={form.preferredLocation}
                      onChange={(v) => setForm((p) => ({ ...p, preferredLocation: v }))}
                      onSelect={(v) => {
                        if (v && !form.preferredLocations.includes(v)) {
                          setForm((p) => ({ ...p, preferredLocations: [...p.preferredLocations, v], preferredLocation: "" }));
                        }
                      }}
                      placeholder="Type city and select or press +"
                      className="flex-1"
                    />
                    <button type="button" onClick={addLocation} className="btn-secondary px-3 shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.preferredLocations.map((loc) => (
                      <span key={loc} className="flex items-center gap-1 badge badge-tech">
                        {loc}
                        <button type="button" onClick={() => setForm((p) => ({ ...p, preferredLocations: p.preferredLocations.filter((l) => l !== loc) }))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Skills & Technologies */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Known Technologies & Skills
                </h2>
                {form.currentRole && (
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-medium">
                    Tailored for: {form.currentRole}
                  </span>
                )}
              </div>
              <input
                className="input mb-3"
                placeholder="Search any technology (e.g. React, Kafka, Terraform, Cypress)…"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
              />
              {skillSearch && filteredSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {filteredSkills.slice(0, 12).map((s) => (
                    <button
                      key={s} type="button"
                      onClick={() => { addSkill(s); setSkillSearch(""); }}
                      className="tag cursor-pointer hover:bg-indigo-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> {s}
                    </button>
                  ))}
                </div>
              )}
              {!skillSearch && (
                <div className="space-y-3 mb-3">
                  {getOrderedCategories(form.currentRole).map(([category, skills]) => {
                    const available = skills.filter((s) => !form.skills.includes(s));
                    if (available.length === 0) return null;
                    return (
                      <div key={category}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {available.map((s) => (
                            <button key={s} type="button" onClick={() => addSkill(s)}
                              className="tag cursor-pointer hover:bg-indigo-500/20 transition-colors text-[11px]">
                              + {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {form.skills.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Selected ({form.skills.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {form.skills.map((s) => (
                      <span key={s} className="flex items-center gap-1 badge badge-verified text-xs">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Resume Upload — REQUIRED */}
            <div id="resume-section" className={`card ${!form.resumeFile && !form.resumeText.trim() ? "border-rose-500/30" : "border-emerald-500/20"}`}>
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                Resume / CV
                <span className="text-rose-400 text-xs font-bold ml-1">* Required</span>
                {(form.resumeFile || form.resumeText.trim()) && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Your resume is used to enrich ATS output, cover letters, skill gap analysis, and LinkedIn suggestions.
              </p>

              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all mb-4 ${
                  dragging ? "border-indigo-400 bg-indigo-500/10" : form.resumeFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-600 hover:border-indigo-500/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {form.resumeFile ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">{form.resumeFile.name}</span>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, resumeFile: null }))} className="text-slate-400 hover:text-rose-400 transition-colors ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm mb-1">Drag & drop your resume here</p>
                    <p className="text-slate-500 text-xs mb-3">PDF, DOCX, or TXT — up to 5MB</p>
                    <label className="btn-secondary text-sm cursor-pointer">
                      Browse File
                      <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) extractAndSetFile(e.target.files[0]); }} />
                    </label>
                  </>
                )}
              </div>

              {/* Paste Text Alternative */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 font-medium px-2">or paste resume text</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
                <textarea
                  className="input resize-none text-xs leading-relaxed font-mono"
                  rows={6}
                  placeholder="Paste your full resume here — name, experience, skills, achievements, education... The more detail, the better your AI-generated resume will be."
                  value={form.resumeText.startsWith("[Resume file:") ? "" : form.resumeText}
                  onChange={(e) => setForm((p) => ({ ...p, resumeText: e.target.value }))}
                />
                {form.resumeText && !form.resumeText.startsWith("[Resume file:") && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {form.resumeText.length} characters saved — AI will use this for all generations
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}
            {!form.resumeFile && !form.resumeText.trim() && (
              <p className="text-xs text-rose-400 text-center flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Please upload or paste your resume to continue
              </p>
            )}
            <button
              type="submit"
              disabled={!form.resumeFile && !form.resumeText.trim()}
              className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              Find My Best Job Matches
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>
          </>
        )}
      </main>
    </div>
  );
}
