"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

type Stage = "INGESTION" | "ANALYSIS" | "PLANNING" | "OUTREACH" | "FEEDBACK";
type View = "PIPELINE" | "EMPLOYEES" | "SETTINGS";

const STAGES: { id: Stage; label: string }[] = [
  { id: "INGESTION", label: "Ingestion" },
  { id: "ANALYSIS", label: "Analysis & Clarification" },
  { id: "PLANNING", label: "Planning & Matchmaking" },
  { id: "OUTREACH", label: "Execution & Outreach" },
  { id: "FEEDBACK", label: "Feedback" },
];

export default function Home() {
  const [activeView, setActiveView] = useState<View>("PIPELINE");
  const [currentStage, setCurrentStage] = useState<Stage>("INGESTION");
  const [isProcessing, setIsProcessing] = useState(false);
  const [thoughtLog, setThoughtLog] = useState<string[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);
  const [humanAnswer, setHumanAnswer] = useState("");
  const [matchCandidates, setMatchCandidates] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [outreachResults, setOutreachResults] = useState<
    { id: string; name: string; role: string; status: string }[]
  >([]);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);
  const [feedbackResults, setFeedbackResults] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Employee State
  const [employees, setEmployees] = useState<any[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);
  const [cvResolution, setCvResolution] = useState<any>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("new");
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [gapsReview, setGapsReview] = useState<any>(null);
  const [isLoadingGaps, setIsLoadingGaps] = useState(false);
  const [sendLinkStatus, setSendLinkStatus] = useState<Record<string, string>>({});

  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchOrgSettings();
  }, []);

  // Poll feedback when on FEEDBACK stage
  const fetchFeedbackResults = useCallback(async () => {
    if (!currentProject?.matchCandidates) return;
    const candidates = currentProject.matchCandidates;
    const updated = await Promise.all(
      candidates.map(async (c: any) => {
        if (!c.feedbackToken) return c;
        try {
          const res = await fetch(`/api/feedback/${c.feedbackToken}`);
          const data = await res.json();
          if (data.status === 'success') {
            return {
              ...c,
              feedbackResponse: data.data.feedbackResponse,
              feedbackComment: data.data.feedbackComment,
              alreadySubmitted: data.data.alreadySubmitted,
            };
          }
        } catch { }
        return c;
      })
    );
    setFeedbackResults(updated);
  }, [currentProject]);

  useEffect(() => {
    if (currentStage !== "FEEDBACK") return;
    fetchFeedbackResults();
    const interval = setInterval(fetchFeedbackResults, 5000);
    return () => clearInterval(interval);
  }, [currentStage, fetchFeedbackResults]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const result = await res.json();
      if (result.status === "success") setEmployees(result.data);
    } catch (err) {
      console.error("Failed to fetch employees");
    }
  };

  const fetchOrgSettings = async () => {
    try {
      const res = await fetch('/api/org-settings');
      const result = await res.json();
      if (result.status === 'success') setOrgSettings(result.data);
    } catch (err) {
      console.error('Failed to fetch org settings');
    }
  };

  // List fields are edited as comma-separated text; number fields are parsed on save.
  const ORG_LIST_FIELDS = ['coreCompetencies', 'industries', 'geographies', 'certifications', 'languages', 'keywords', 'cpvCodes', 'exclusionCriteria'];
  const ORG_NUMBER_FIELDS = ['minContractValue', 'maxContractValue', 'maxTeamSize'];

  const setOrgField = (field: string, value: any) => {
    setOrgSettings((prev: any) => ({ ...prev, [field]: value }));
    setSettingsSaved(false);
  };

  const handleSaveOrgSettings = async () => {
    if (!orgSettings) return;
    setIsSavingSettings(true);
    try {
      // Normalize list fields (comma-separated strings -> arrays) and number fields.
      const payload: any = { ...orgSettings };
      for (const f of ORG_LIST_FIELDS) {
        if (typeof payload[f] === 'string') {
          payload[f] = payload[f].split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      for (const f of ORG_NUMBER_FIELDS) {
        payload[f] = payload[f] === '' || payload[f] === undefined || payload[f] === null ? undefined : Number(payload[f]);
      }
      const res = await fetch('/api/org-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.status === 'success') {
        setOrgSettings(result.data);
        setSettingsSaved(true);
      }
    } catch (err) {
      console.error('Failed to save org settings', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setUploadedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existingNames.has(f.name))];
    });
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!uploadedFiles.length) return;

    setIsProcessing(true);
    setCurrentStage("ANALYSIS");
    const fileList = uploadedFiles.map((f) => f.name).join(", ");
    setThoughtLog([
      "> Initializing agent brain...",
      `> Loading ${uploadedFiles.length} document${uploadedFiles.length > 1 ? "s" : ""}: ${fileList}`,
      uploadedFiles.length > 1
        ? "> Merging documents as single RFP..."
        : "> Analyzing document...",
    ]);

    const formData = new FormData();
    for (const file of uploadedFiles) {
      formData.append("files", file);
    }

    try {
      const response = await fetch("/api/process-rfq", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.status === "success") {
        setCurrentProject(result.data);
        setThoughtLog(result.data.thoughtLog);
        setClarification(result.data.clarificationQuestion);
      } else {
        setThoughtLog((prev) => [...prev, `> Error: ${result.error}`]);
      }
    } catch (error) {
      console.error("Error:", error);
      setThoughtLog((prev) => [
        ...prev,
        "> Critical Error: Connection failed.",
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!currentProject) return;

    setIsProcessing(true);
    setThoughtLog((prev) => [
      ...prev,
      "> Human input received.",
      "> Recalculating planning strategy...",
    ]);

    try {
      const response = await fetch("/api/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProject.id,
          humanAnswer,
        }),
      });

      const result = await response.json();

      if (result.status === "success") {
        setCurrentProject(result.data);
        setMatchCandidates(result.data.matchCandidates);
        setThoughtLog(result.data.thoughtLog);
        setCurrentStage("PLANNING");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEmployee),
      });
      if (res.ok) {
        setEditingEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      console.error("Failed to update employee");
    }
  };

  const buildNewEmployee = (extracted: any, cvUrl: string) => ({
    id: uuidv4(),
    email: extracted.email || "",
    firstName: extracted.firstName || "",
    lastName: extracted.lastName || "",
    location: extracted.location || "",
    role: extracted.role || "",
    level: extracted.level || "",
    yearsOfExperience: extracted.yearsOfExperience ?? 0,
    pastIndustryExperience: extracted.pastIndustryExperience || [],
    futureIndustryWish: [],
    skills: extracted.skills || [],
    certifications: extracted.certifications || [],
    availabilityStatus: "Available",
    projectStart: "",
    projectEnd: "",
    cv: cvUrl,
    linkedin: extracted.linkedin || "",
  });

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCV(true);
    setCvUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/employees/extract", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (result.status !== "success") {
        throw new Error(result.error || "Extraction failed");
      }

      const { extracted, cvUrl, matches } = result.data;

      if (!matches || matches.length === 0) {
        const newEmployee = buildNewEmployee(extracted, cvUrl);
        await fetch(`/api/employees/${newEmployee.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEmployee),
        });
        await fetchEmployees();
        await openProfileGaps(newEmployee);
      } else {
        setSelectedMatchId("new");
        setCvResolution({ extracted, cvUrl, matches });
      }
    } catch (err) {
      console.error("Failed to extract CV", err);
      setCvUploadError("Failed to extract CV. Please try again.");
    } finally {
      setIsUploadingCV(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  };

  const handleResolveCV = async () => {
    if (!cvResolution) return;
    const { extracted, cvUrl, matches } = cvResolution;

    let employee;
    if (selectedMatchId === "new") {
      employee = buildNewEmployee(extracted, cvUrl);
    } else {
      const existing = matches.find((m: any) => m.id === selectedMatchId);
      employee = {
        ...existing,
        email: extracted.email || existing.email,
        location: extracted.location || existing.location,
        role: extracted.role || existing.role,
        level: extracted.level || existing.level,
        yearsOfExperience:
          extracted.yearsOfExperience ?? existing.yearsOfExperience,
        pastIndustryExperience: extracted.pastIndustryExperience?.length
          ? extracted.pastIndustryExperience
          : existing.pastIndustryExperience,
        skills: extracted.skills?.length ? extracted.skills : existing.skills,
        certifications: extracted.certifications?.length
          ? extracted.certifications
          : existing.certifications,
        linkedin: extracted.linkedin || existing.linkedin,
        cv: cvUrl,
      };
    }

    try {
      await fetch(`/api/employees/${employee.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employee),
      });
      await fetchEmployees();
      await openProfileGaps(employee);
    } catch (err) {
      console.error("Failed to save employee", err);
    } finally {
      setCvResolution(null);
    }
  };

  const openProfileGaps = async (employee: any) => {
    setIsLoadingGaps(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/gaps`);
      const result = await res.json();
      const gaps = result.status === 'success' ? result.data : [];
      const hasPending = employee.pendingUpdates && Object.keys(employee.pendingUpdates).length > 0;
      if (gaps.length > 0 || hasPending) {
        setGapsReview({ employee, gaps, answers: {}, skipped: [] as string[] });
      }
    } catch (err) {
      console.error('Failed to fetch profile gaps', err);
    } finally {
      setIsLoadingGaps(false);
    }
  };

  const ARRAY_FIELDS = ['skills', 'certifications', 'pastIndustryExperience', 'futureIndustryWish'];

  const setGapAnswer = (field: string, value: string) => {
    setGapsReview((prev: any) => ({ ...prev, answers: { ...prev.answers, [field]: value } }));
  };

  const toggleSkipGap = (field: string) => {
    setGapsReview((prev: any) => ({
      ...prev,
      skipped: prev.skipped.includes(field)
        ? prev.skipped.filter((f: string) => f !== field)
        : [...prev.skipped, field],
    }));
  };

  const handleSaveGapAnswers = async () => {
    if (!gapsReview) return;
    const { employee, gaps, answers, skipped } = gapsReview;
    const updated = { ...employee };

    for (const gap of gaps) {
      if (skipped.includes(gap.field)) continue;
      const value = answers[gap.field];
      if (value === undefined || value === '') continue;

      if (ARRAY_FIELDS.includes(gap.field)) {
        updated[gap.field] = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (gap.field === 'yearsOfExperience') {
        updated[gap.field] = Number(value);
      } else {
        updated[gap.field] = value;
      }
    }

    const dismissed = new Set<string>(employee.dismissedGapFields || []);
    skipped.forEach((f: string) => dismissed.add(f));
    updated.dismissedGapFields = Array.from(dismissed);

    try {
      await fetch(`/api/employees/${updated.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      await fetchEmployees();
    } catch (err) {
      console.error('Failed to save profile answers', err);
    } finally {
      setGapsReview(null);
    }
  };

  const handleSendLink = async (employee: any) => {
    setSendLinkStatus(prev => ({ ...prev, [employee.id]: 'sending' }));
    try {
      const res = await fetch(`/api/employees/${employee.id}/send-link`, { method: 'POST' });
      const result = await res.json();
      if (result.status !== 'success') {
        setSendLinkStatus(prev => ({ ...prev, [employee.id]: 'error' }));
        return;
      }
      // Always copy the link so HR can share it even when email isn't configured.
      const link = result.data?.link;
      if (link) {
        try { await navigator.clipboard.writeText(link); } catch { /* clipboard may be blocked */ }
      }
      // 'sent' = email delivered; 'copied' = link ready on clipboard (no mail provider).
      setSendLinkStatus(prev => ({ ...prev, [employee.id]: result.data?.emailSent ? 'sent' : 'copied' }));
    } catch (err) {
      console.error('Failed to send profile link', err);
      setSendLinkStatus(prev => ({ ...prev, [employee.id]: 'error' }));
    }
  };

  const handlePendingDecision = async (field: string, accept: boolean) => {
    if (!gapsReview) return;
    const employee = { ...gapsReview.employee };
    const pending = { ...(employee.pendingUpdates || {}) };
    const entry = pending[field];
    delete pending[field];

    if (accept && entry) {
      employee[field] = entry.value;
    }
    employee.pendingUpdates = pending;

    try {
      await fetch(`/api/employees/${employee.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      });
      await fetchEmployees();
      setGapsReview((prev: any) => (prev ? { ...prev, employee } : prev));
    } catch (err) {
      console.error('Failed to update pending field', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h2 className="font-bold text-xl tracking-tighter">
              Hackathon Munich Agent
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveView("PIPELINE")}
                className={`text-sm font-medium transition-colors ${activeView === "PIPELINE" ? "text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                RFQ Pipeline
              </button>
              <button
                onClick={() => setActiveView("EMPLOYEES")}
                className={`text-sm font-medium transition-colors ${activeView === "EMPLOYEES" ? "text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                Employees
              </button>
              <button
                onClick={() => setActiveView('SETTINGS')}
                className={`text-sm font-medium transition-colors ${activeView === 'SETTINGS' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                Org Settings
              </button>
            </div>
          </div>
          <div className="text-xs font-mono bg-zinc-200 dark:bg-zinc-800 px-3 py-1 rounded-full text-zinc-600 dark:text-zinc-400">
            {isProcessing ? "Agent: Thinking..." : "Agent: Idle"}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {activeView === "PIPELINE" ? (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <header className="mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-2">
                  Project Pipeline
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                  Process and match your RFQs natively.
                </p>
              </header>

              {/* Pipeline Stepper */}
              <div className="flex justify-between items-center mb-12 relative px-4">
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-zinc-200 dark:bg-zinc-800 -z-10" />
                {STAGES.map((stage, index) => {
                  const isActive = currentStage === stage.id;
                  const isCompleted =
                    STAGES.findIndex((s) => s.id === currentStage) > index;

                  return (
                    <div
                      key={stage.id}
                      className="flex flex-col items-center gap-2 bg-zinc-50 dark:bg-zinc-950 px-4"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive
                          ? "border-blue-500 bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/20"
                          : isCompleted
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          }`}
                      >
                        {isCompleted ? "✓" : index + 1}
                      </div>
                      <span
                        className={`text-sm font-medium ${isActive ? "text-blue-500" : "text-zinc-500"}`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Content Area */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm min-h-[500px] p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    {currentStage === "INGESTION" && (
                      <div className="space-y-6">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".pdf,.txt"
                          multiple
                          onChange={handleFileSelect}
                        />
                        {/* Drop zone */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/10 transition-all group"
                        >
                          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                            📄
                          </div>
                          <p className="font-semibold mb-1">
                            Click to add files
                          </p>
                          <p className="text-zinc-500 text-sm text-center max-w-xs">
                            PDF, DOCX, or TXT — add all documents belonging to
                            this RFP
                          </p>
                        </div>

                        {/* File list */}
                        {uploadedFiles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                              {uploadedFiles.length} file
                              {uploadedFiles.length > 1 ? "s" : ""} staged
                            </p>
                            {uploadedFiles.map((file, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-green-500 text-sm">
                                    ✓
                                  </span>
                                  <span className="text-sm font-medium">
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-zinc-400">
                                    {(file.size / 1024).toFixed(0)} KB
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    setUploadedFiles((prev) =>
                                      prev.filter((_, idx) => idx !== i),
                                    )
                                  }
                                  className="text-zinc-400 hover:text-red-500 transition-colors text-sm px-2"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Analyze button */}
                        <button
                          onClick={handleAnalyze}
                          disabled={uploadedFiles.length === 0}
                          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                        >
                          {uploadedFiles.length === 0
                            ? "Add files to begin"
                            : `Analyze RFP${uploadedFiles.length > 1 ? ` (${uploadedFiles.length} files)` : ""}`}
                        </button>
                      </div>
                    )}

                    {currentStage === "ANALYSIS" && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                          <h3 className="text-2xl font-bold">
                            Agent Analysis: {currentProject?.name}
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="lg:col-span-2 space-y-6">
                            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-2xl">
                              <h4 className="font-semibold mb-4 text-zinc-500 uppercase text-[10px] tracking-widest">
                                System Thought Log
                              </h4>
                              <div className="space-y-2 font-mono text-sm h-64 overflow-y-auto">
                                {thoughtLog.map((log, i) => (
                                  <motion.p
                                    key={i}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={
                                      log.includes("ambiguity")
                                        ? "text-amber-400"
                                        : log.includes("complete")
                                          ? "text-green-400"
                                          : "text-zinc-400"
                                    }
                                  >
                                    {log}
                                  </motion.p>
                                ))}
                                {isProcessing && (
                                  <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 0.8,
                                    }}
                                    className="inline-block w-2 h-4 bg-zinc-600 ml-1 translate-y-1"
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <AnimatePresence>
                              {clarification && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-6 rounded-2xl shadow-xl"
                                >
                                  <div className="flex items-center gap-2 mb-4">
                                    <span className="text-xl">🤔</span>
                                    <h4 className="font-bold text-amber-900 dark:text-amber-100">
                                      Clarification Needed
                                    </h4>
                                  </div>
                                  <p className="text-amber-800 dark:text-amber-300 mb-6 text-sm leading-relaxed">
                                    {clarification}
                                  </p>
                                  <div className="space-y-3">
                                    <input
                                      type="text"
                                      value={humanAnswer}
                                      onChange={(e) =>
                                        setHumanAnswer(e.target.value)
                                      }
                                      placeholder="Type your answer..."
                                      className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                    />
                                    <button
                                      onClick={handleClarificationSubmit}
                                      disabled={isProcessing}
                                      className="w-full bg-amber-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                                    >
                                      {isProcessing
                                        ? "Thinking..."
                                        : "Send to Agent"}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStage === "PLANNING" && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                          <h3 className="text-2xl font-bold">
                            Matchmaking Results
                          </h3>
                        </div>

                        {/* Required Skills from RFP */}
                        {currentProject?.requirements?.length > 0 && (
                          <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                              Project Requirements
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {currentProject.requirements.map(
                                (req: string, i: number) => (
                                  <span
                                    key={i}
                                    className="bg-zinc-200 dark:bg-zinc-800 text-[10px] px-2.5 py-1 rounded-lg font-medium text-zinc-700 dark:text-zinc-300"
                                  >
                                    {req}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {matchCandidates
                            .filter((candidate) => candidate.match > 0)
                            .map((candidate) => {
                              const pct = candidate.match;
                              const matchColor =
                                pct >= 75
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : pct >= 50
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : pct >= 25
                                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

                              const barColor =
                                pct >= 75
                                  ? "bg-green-500"
                                  : pct >= 50
                                    ? "bg-blue-500"
                                    : pct >= 25
                                      ? "bg-orange-500"
                                      : "bg-red-500";

                              return (
                                <div
                                  key={candidate.id}
                                  className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col"
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                                        👤
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-sm">
                                          {candidate.name}
                                        </h4>
                                        <p className="text-[11px] text-zinc-500">
                                          {candidate.role}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`${matchColor} text-[10px] px-2 py-1 rounded-lg font-bold`}
                                    >
                                      {candidate.match}%
                                    </span>
                                  </div>

                                  {/* Match bar */}
                                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-4 overflow-hidden">
                                    <div
                                      className={`h-full ${barColor} rounded-full transition-all`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>

                                  {/* Reason */}
                                  <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-3 mb-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                                      Why this match
                                    </p>
                                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                      {candidate.reason}
                                    </p>
                                  </div>

                                  {/* Matching skills */}
                                  <div className="mt-auto">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                                      Relevant Skills
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {candidate.skills.map((s: string) => (
                                        <span
                                          key={s}
                                          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded-md border border-green-200 dark:border-green-800 font-medium"
                                        >
                                          ✓ {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        <div className="pt-8 text-center">
                          <button
                            onClick={async () => {
                              if (!currentProject) return;
                              setIsSendingOutreach(true);
                              setCurrentStage("OUTREACH");
                              try {
                                const res = await fetch("/api/outreach", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    projectId: currentProject.id,
                                  }),
                                });
                                const result = await res.json();
                                if (result.status === "success") {
                                  setOutreachResults(result.data.notifications);
                                  if (result.data.project) {
                                    setCurrentProject(result.data.project);
                                  }
                                }
                              } catch (err) {
                                console.error("Outreach failed:", err);
                              } finally {
                                setIsSendingOutreach(false);
                              }
                            }}
                            disabled={isSendingOutreach}
                            className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                          >
                            Finalize Team & Notify
                          </button>
                        </div>
                      </div>
                    )}

                    {currentStage === "OUTREACH" && (
                      <div className="space-y-8">
                        {isSendingOutreach ? (
                          <div className="flex flex-col items-center justify-center h-[400px] text-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                ease: "linear",
                              }}
                              className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mb-6"
                            />
                            <h3 className="text-2xl font-bold mb-2">
                              Sending Notifications...
                            </h3>
                            <p className="text-zinc-500">
                              Contacting team members via ntfy.sh
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                              <h3 className="text-2xl font-bold">
                                Outreach Complete
                              </h3>
                            </div>

                            {/* Selected PM Card */}
                            {currentProject?.selectedPM && (
                              <div className="p-6 border-2 border-blue-200 dark:border-blue-800 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xl">
                                    👔
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-lg">
                                        {currentProject.selectedPM.name}
                                      </h4>
                                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase">
                                        Project Manager
                                      </span>
                                    </div>
                                    <p className="text-sm text-zinc-500">
                                      {currentProject.selectedPM.role} &middot;{" "}
                                      {currentProject.selectedPM.email}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Project Summary */}
                            <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50">
                              <h4 className="font-bold mb-3 text-sm uppercase tracking-widest text-zinc-400">
                                Project Summary
                              </h4>
                              <p className="font-semibold mb-3">
                                {currentProject?.name}
                              </p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {(currentProject?.requirements || [])
                                  .slice(0, 5)
                                  .map((req: string, i: number) => (
                                    <p
                                      key={i}
                                      className="text-xs text-zinc-600 dark:text-zinc-400"
                                    >
                                      • {req}
                                    </p>
                                  ))}
                                {(currentProject?.requirements || []).length >
                                  5 && (
                                    <p className="text-xs text-zinc-400 italic">
                                      ... and{" "}
                                      {currentProject.requirements.length - 5}{" "}
                                      more requirements
                                    </p>
                                  )}
                              </div>
                            </div>

                            {/* Notification Status */}
                            <div>
                              <h4 className="font-bold mb-4 text-sm uppercase tracking-widest text-zinc-400">
                                Notification Status
                              </h4>
                              <div className="space-y-2">
                                {outreachResults.map((n) => (
                                  <div
                                    key={n.id}
                                    className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-sm">
                                        {n.role === "Project Manager"
                                          ? "👔"
                                          : "👤"}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">
                                          {n.name}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                          {n.role}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs font-bold px-3 py-1 rounded-lg ${n.status === "sent"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        }`}
                                    >
                                      {n.status === "sent"
                                        ? "✓ Sent"
                                        : "✗ Failed"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-4 flex items-center justify-center gap-6">
                              <button
                                onClick={() => {
                                  setCurrentStage("FEEDBACK");
                                }}
                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                              >
                                View Feedback →
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentStage("INGESTION");
                                  setCurrentProject(null);
                                  setMatchCandidates([]);
                                  setOutreachResults([]);
                                  setFeedbackResults([]);
                                }}
                                className="text-blue-500 font-medium hover:underline"
                              >
                                Process another RFQ
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {currentStage === "FEEDBACK" && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                          <h3 className="text-2xl font-bold">
                            Team Feedback
                          </h3>
                          <span className="text-xs text-zinc-400 animate-pulse">● Live</span>
                        </div>

                        <p className="text-sm text-zinc-500">
                          Awaiting responses from team members for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{currentProject?.name}</span>
                        </p>

                        {/* Progress bar */}
                        {feedbackResults.filter((c: any) => c.match >= 20).length > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-zinc-500 mb-2">
                              <span>{feedbackResults.filter((c: any) => c.match >= 20 && c.feedbackResponse).length} of {feedbackResults.filter((c: any) => c.match >= 20).length} responded</span>
                              <span>{Math.round((feedbackResults.filter((c: any) => c.match >= 20 && c.feedbackResponse).length / feedbackResults.filter((c: any) => c.match >= 20).length) * 100)}%</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${(feedbackResults.filter((c: any) => c.match >= 20 && c.feedbackResponse).length / feedbackResults.filter((c: any) => c.match >= 20).length) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          {feedbackResults.filter((c: any) => c.match >= 20).map((candidate: any) => (
                            <div
                              key={candidate.id}
                              className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-lg">
                                    👤
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{candidate.name}</p>
                                    <p className="text-xs text-zinc-500">{candidate.role} · {candidate.match}% match</p>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-bold px-3 py-1 rounded-lg ${candidate.feedbackResponse === 'accepted'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : candidate.feedbackResponse === 'declined'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}
                                >
                                  {candidate.feedbackResponse === 'accepted'
                                    ? '✓ Accepted'
                                    : candidate.feedbackResponse === 'declined'
                                      ? '✗ Declined'
                                      : '⏳ Pending'}
                                </span>
                              </div>
                              {candidate.feedbackComment && (
                                <div className="mt-3 ml-13">
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-4 py-3 italic">
                                    &ldquo;{candidate.feedbackComment}&rdquo;
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {feedbackResults.length === 0 && (
                          <p className="text-center text-zinc-400 py-12">No team members to show.</p>
                        )}

                        <div className="pt-4 text-center">
                          <button
                            onClick={() => {
                              setCurrentStage("INGESTION");
                              setCurrentProject(null);
                              setMatchCandidates([]);
                              setOutreachResults([]);
                              setFeedbackResults([]);
                            }}
                            className="text-blue-500 font-medium hover:underline"
                          >
                            Process another RFQ
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : activeView === 'EMPLOYEES' ? (
            <motion.div
              key="employees"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <header className="mb-12 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-2">
                    Employee Database
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                    Manage profiles used for matchmaking.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <input
                    type="file"
                    ref={cvInputRef}
                    className="hidden"
                    accept=".pdf"
                    onChange={handleCVUpload}
                  />
                  <button
                    onClick={() => cvInputRef.current?.click()}
                    disabled={isUploadingCV}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {isUploadingCV ? "Extracting CV..." : "+ Upload CV"}
                  </button>
                  {cvUploadError && (
                    <p className="text-xs text-red-500">{cvUploadError}</p>
                  )}
                </div>
              </header>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-[10px] uppercase tracking-widest text-zinc-400">
                      <th className="px-4 py-3 font-bold">Employee Id</th>
                      <th className="px-4 py-3 font-bold">Email</th>
                      <th className="px-4 py-3 font-bold">First Name</th>
                      <th className="px-4 py-3 font-bold">Last Name</th>
                      <th className="px-4 py-3 font-bold">Location</th>
                      <th className="px-4 py-3 font-bold">Role</th>
                      <th className="px-4 py-3 font-bold">Level</th>
                      <th className="px-4 py-3 font-bold">
                        Years Of Experience
                      </th>
                      <th className="px-4 py-3 font-bold">
                        Past Industry Experience
                      </th>
                      <th className="px-4 py-3 font-bold">
                        Future Industry Wish
                      </th>
                      <th className="px-4 py-3 font-bold">Skills</th>
                      <th className="px-4 py-3 font-bold">Certifications</th>
                      <th className="px-4 py-3 font-bold">
                        Availability Status
                      </th>
                      <th className="px-4 py-3 font-bold">Project Start</th>
                      <th className="px-4 py-3 font-bold">Project End</th>
                      <th className="px-4 py-3 font-bold">CV</th>
                      <th className="px-4 py-3 font-bold">LinkedIn</th>
                      <th className="px-4 py-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {emp.id}
                        </td>
                        <td className="px-4 py-3">{emp.email}</td>
                        <td className="px-4 py-3 font-medium">
                          {emp.firstName}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {emp.lastName}
                        </td>
                        <td className="px-4 py-3">{emp.location}</td>
                        <td className="px-4 py-3">{emp.role}</td>
                        <td className="px-4 py-3">{emp.level}</td>
                        <td className="px-4 py-3">{emp.yearsOfExperience}</td>
                        <td className="px-4 py-3">
                          {(emp.pastIndustryExperience || []).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          {(emp.futureIndustryWish || []).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(emp.skills || []).map((s: string) => (
                              <span
                                key={s}
                                className="bg-zinc-50 dark:bg-zinc-950 text-[10px] px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 font-medium whitespace-nowrap"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(emp.certifications || []).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] px-2 py-1 rounded-lg font-bold ${emp.availabilityStatus === "Available" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            {emp.availabilityStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">{emp.projectStart}</td>
                        <td className="px-4 py-3">{emp.projectEnd}</td>
                        <td className="px-4 py-3">
                          {emp.cv ? (
                            <a
                              href={emp.cv}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              View CV
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {emp.linkedin ? (
                            <a
                              href={emp.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              Profile
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => setEditingEmployee(emp)}
                              className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openProfileGaps(emp)}
                              disabled={isLoadingGaps}
                              className="text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 relative"
                            >
                              Review
                              {emp.pendingUpdates && Object.keys(emp.pendingUpdates).length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                              )}
                            </button>
                            <button
                              onClick={() => handleSendLink(emp)}
                              disabled={sendLinkStatus[emp.id] === 'sending'}
                              className="text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {sendLinkStatus[emp.id] === 'sending' ? 'Sending...' : sendLinkStatus[emp.id] === 'sent' ? 'Sent ✓' : sendLinkStatus[emp.id] === 'copied' ? 'Link copied ✓' : sendLinkStatus[emp.id] === 'error' ? 'Failed' : 'Send Link'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Edit Modal */}
              <AnimatePresence>
                {editingEmployee && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto"
                    >
                      <h3 className="text-2xl font-bold mb-6">
                        Edit Employee Profile
                      </h3>
                      <form
                        onSubmit={handleUpdateEmployee}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.firstName}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  firstName: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.lastName}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  lastName: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editingEmployee.email}
                            onChange={(e) =>
                              setEditingEmployee({
                                ...editingEmployee,
                                email: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Location
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.location}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  location: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Level
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.level}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  level: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Role
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.role}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  role: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Years Of Experience
                            </label>
                            <input
                              type="number"
                              value={editingEmployee.yearsOfExperience}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  yearsOfExperience: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                            Skills (comma separated)
                          </label>
                          <input
                            type="text"
                            value={(editingEmployee.skills || []).join(", ")}
                            onChange={(e) =>
                              setEditingEmployee({
                                ...editingEmployee,
                                skills: e.target.value
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                            Certifications (comma separated)
                          </label>
                          <input
                            type="text"
                            value={(editingEmployee.certifications || []).join(
                              ", ",
                            )}
                            onChange={(e) =>
                              setEditingEmployee({
                                ...editingEmployee,
                                certifications: e.target.value
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Past Industry Experience (comma separated)
                            </label>
                            <input
                              type="text"
                              value={(
                                editingEmployee.pastIndustryExperience || []
                              ).join(", ")}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  pastIndustryExperience: e.target.value
                                    .split(",")
                                    .map((s: string) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Future Industry Wish (comma separated)
                            </label>
                            <input
                              type="text"
                              value={(
                                editingEmployee.futureIndustryWish || []
                              ).join(", ")}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  futureIndustryWish: e.target.value
                                    .split(",")
                                    .map((s: string) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Availability Status
                            </label>
                            <select
                              value={editingEmployee.availabilityStatus}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  availabilityStatus: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            >
                              <option value="Available">Available</option>
                              <option value="On Project">On Project</option>
                              <option value="Unavailable">Unavailable</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Project Start
                            </label>
                            <input
                              type="date"
                              value={editingEmployee.projectStart}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  projectStart: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              Project End
                            </label>
                            <input
                              type="date"
                              value={editingEmployee.projectEnd}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  projectEnd: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              CV URL
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.cv}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  cv: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
                              LinkedIn URL
                            </label>
                            <input
                              type="text"
                              value={editingEmployee.linkedin}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  linkedin: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-4 pt-4">
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(null)}
                            className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* CV Duplicate Resolution Modal */}
              <AnimatePresence>
                {cvResolution && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
                    >
                      <h3 className="text-2xl font-bold mb-2">
                        Possible Duplicate Found
                      </h3>
                      <p className="text-sm text-zinc-500 mb-6">
                        We found existing employee(s) named{" "}
                        <span className="font-bold">
                          {cvResolution.extracted.firstName}{" "}
                          {cvResolution.extracted.lastName}
                        </span>
                        . Choose whether to update one of them or add this CV as
                        a new employee.
                      </p>

                      <div className="space-y-3 mb-6">
                        {cvResolution.matches.map((m: any) => (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedMatchId === m.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-800"}`}
                          >
                            <input
                              type="radio"
                              name="cv-resolution"
                              value={m.id}
                              checked={selectedMatchId === m.id}
                              onChange={() => setSelectedMatchId(m.id)}
                            />
                            <div>
                              <p className="font-bold text-sm">
                                {m.firstName} {m.lastName}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {m.role} · {m.email}
                              </p>
                            </div>
                          </label>
                        ))}
                        <label
                          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedMatchId === "new" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-800"}`}
                        >
                          <input
                            type="radio"
                            name="cv-resolution"
                            value="new"
                            checked={selectedMatchId === "new"}
                            onChange={() => setSelectedMatchId("new")}
                          />
                          <p className="font-bold text-sm">
                            Add as new employee
                          </p>
                        </label>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setCvResolution(null)}
                          className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleResolveCV}
                          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold"
                        >
                          Confirm
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Profile Gap Review Modal */}
              <AnimatePresence>
                {gapsReview && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto"
                    >
                      <h3 className="text-2xl font-bold mb-2">Complete Profile</h3>
                      <p className="text-sm text-zinc-500 mb-6">
                        A few things would help us match{' '}
                        <span className="font-bold">{gapsReview.employee.firstName} {gapsReview.employee.lastName}</span>{' '}
                        to projects more accurately.
                      </p>

                      {gapsReview.employee.pendingUpdates && Object.keys(gapsReview.employee.pendingUpdates).length > 0 && (
                        <div className="space-y-3 mb-6">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">From employee uploads</h4>
                          {Object.entries(gapsReview.employee.pendingUpdates).map(([field, p]: [string, any]) => {
                            const value = Array.isArray(p.value) ? p.value.join(', ') : p.value;
                            return (
                              <div key={field} className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10">
                                <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded mt-0.5">NEW</span>
                                <div className="flex-1">
                                  <p className="text-sm font-bold">{field}: <span className="font-normal">{value}</span></p>
                                  <p className="text-xs text-zinc-500">From {p.source} · confidence {Math.round(p.confidence)}% · {p.reasoning}</p>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handlePendingDecision(field, true)}
                                    className="text-xs font-bold text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 px-2 py-1 rounded-lg"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePendingDecision(field, false)}
                                    className="text-xs font-bold text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-5 mb-6">
                        {gapsReview.gaps.map((gap: any) => {
                          const skipped = gapsReview.skipped.includes(gap.field);
                          return (
                            <div key={gap.field} className={skipped ? 'opacity-40' : ''}>
                              <label className="text-sm font-bold mb-1 block">{gap.question}</label>
                              {gap.reasoning && (
                                <p className="text-xs text-zinc-400 mb-2">{gap.reasoning}</p>
                              )}
                              <div className="flex gap-2">
                                {gap.options && gap.options.length > 0 ? (
                                  <select
                                    value={gapsReview.answers[gap.field] || ''}
                                    onChange={(e) => setGapAnswer(gap.field, e.target.value)}
                                    disabled={skipped}
                                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                                  >
                                    <option value="">— Select —</option>
                                    {gap.options.map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={gapsReview.answers[gap.field] || ''}
                                    onChange={(e) => setGapAnswer(gap.field, e.target.value)}
                                    disabled={skipped}
                                    placeholder={ARRAY_FIELDS.includes(gap.field) ? 'Comma separated' : ''}
                                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleSkipGap(gap.field)}
                                  className={`text-xs font-bold px-3 rounded-xl border transition-colors ${skipped ? 'border-blue-500 text-blue-500' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'}`}
                                >
                                  {skipped ? 'Skipped' : 'Skip'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setGapsReview(null)}
                          className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveGapAnswers}
                          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold"
                        >
                          Save Answers
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tighter mb-1">Organization Settings</h1>
                <p className="text-zinc-500 text-sm">
                  Defines who you are and what you bid on. Used to qualify inbound tenders and to
                  parameterize the outbound tender search.
                </p>
              </div>

              {!orgSettings ? (
                <p className="text-zinc-400">Loading settings...</p>
              ) : (
                <div className="space-y-6 max-w-3xl">
                  {/* Identity */}
                  <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold">Company</h2>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1 block">Company name</label>
                      <input
                        type="text"
                        value={orgSettings.companyName || ''}
                        onChange={(e) => setOrgField('companyName', e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1 block">What we do</label>
                      <textarea
                        value={orgSettings.description || ''}
                        onChange={(e) => setOrgField('description', e.target.value)}
                        rows={3}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                      />
                    </div>
                  </section>

                  {/* Capabilities — qualification inputs */}
                  <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold">Capabilities & scope</h2>
                    <p className="text-xs text-zinc-500 -mt-2">Comma-separated. These are matched against each tender to decide bid / no-bid.</p>
                    {[
                      { field: 'coreCompetencies', label: 'Core competencies' },
                      { field: 'industries', label: 'Industries served' },
                      { field: 'geographies', label: 'Geographies' },
                      { field: 'certifications', label: 'Certifications held' },
                      { field: 'languages', label: 'Languages' },
                    ].map(({ field, label }) => (
                      <div key={field}>
                        <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1 block">{label}</label>
                        <input
                          type="text"
                          value={Array.isArray(orgSettings[field]) ? orgSettings[field].join(', ') : (orgSettings[field] || '')}
                          onChange={(e) => setOrgField(field, e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { field: 'minContractValue', label: 'Min value (€)' },
                        { field: 'maxContractValue', label: 'Max value (€)' },
                        { field: 'maxTeamSize', label: 'Max team size' },
                      ].map(({ field, label }) => (
                        <div key={field}>
                          <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1 block">{label}</label>
                          <input
                            type="number"
                            value={orgSettings[field] ?? ''}
                            onChange={(e) => setOrgField(field, e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Outbound search + no-bid rules */}
                  <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold">Outbound search & exclusions</h2>
                    <p className="text-xs text-zinc-500 -mt-2">Comma-separated. Seeds the tender crawl; exclusions are hard no-bid rules.</p>
                    {[
                      { field: 'keywords', label: 'Search keywords' },
                      { field: 'cpvCodes', label: 'CPV codes (EU public tenders)' },
                      { field: 'exclusionCriteria', label: 'Exclusion criteria (never bid)' },
                    ].map(({ field, label }) => (
                      <div key={field}>
                        <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1 block">{label}</label>
                        <input
                          type="text"
                          value={Array.isArray(orgSettings[field]) ? orgSettings[field].join(', ') : (orgSettings[field] || '')}
                          onChange={(e) => setOrgField(field, e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </section>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleSaveOrgSettings}
                      disabled={isSavingSettings}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isSavingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                    {settingsSaved && <span className="text-sm text-green-600">Saved ✓</span>}
                    {orgSettings.updatedAt && (
                      <span className="text-xs text-zinc-400">Last updated {new Date(orgSettings.updatedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
