'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Stage = 'INGESTION' | 'ANALYSIS' | 'PLANNING' | 'OUTREACH';
type View = 'PIPELINE' | 'EMPLOYEES';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'INGESTION', label: 'Ingestion' },
  { id: 'ANALYSIS', label: 'Analysis & Clarification' },
  { id: 'PLANNING', label: 'Planning & Matchmaking' },
  { id: 'OUTREACH', label: 'Execution & Outreach' },
];

export default function Home() {
  const [activeView, setActiveView] = useState<View>('PIPELINE');
  const [currentStage, setCurrentStage] = useState<Stage>('INGESTION');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thoughtLog, setThoughtLog] = useState<string[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);
  const [humanAnswer, setHumanAnswer] = useState('');
  const [matchCandidates, setMatchCandidates] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Employee State
  const [employees, setEmployees] = useState<any[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const result = await res.json();
      if (result.status === 'success') setEmployees(result.data);
    } catch (err) {
      console.error('Failed to fetch employees');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCurrentStage('ANALYSIS');
    setThoughtLog(['> Initializing agent brain...', `> Reading ${file.name}...`]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-rfq', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status === 'success') {
        setCurrentProject(result.data);
        setThoughtLog(result.data.thoughtLog);
        setClarification(result.data.clarificationQuestion);
      } else {
        setThoughtLog(prev => [...prev, `> Error: ${result.error}`]);
      }
    } catch (error) {
      console.error('Error:', error);
      setThoughtLog(prev => [...prev, '> Critical Error: Connection failed.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!currentProject) return;

    setIsProcessing(true);
    setThoughtLog(prev => [...prev, '> Human input received.', '> Recalculating planning strategy...']);
    
    try {
      const response = await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          humanAnswer
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setCurrentProject(result.data);
        setMatchCandidates(result.data.matchCandidates);
        setThoughtLog(result.data.thoughtLog);
        setCurrentStage('PLANNING');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEmployee),
      });
      if (res.ok) {
        setEditingEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      console.error('Failed to update employee');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h2 className="font-bold text-xl tracking-tighter">Tacto Agent</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveView('PIPELINE')}
                className={`text-sm font-medium transition-colors ${activeView === 'PIPELINE' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                RFQ Pipeline
              </button>
              <button 
                onClick={() => setActiveView('EMPLOYEES')}
                className={`text-sm font-medium transition-colors ${activeView === 'EMPLOYEES' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                Employees
              </button>
            </div>
          </div>
          <div className="text-xs font-mono bg-zinc-200 dark:bg-zinc-800 px-3 py-1 rounded-full text-zinc-600 dark:text-zinc-400">
            {isProcessing ? 'Agent: Thinking...' : 'Agent: Idle'}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {activeView === 'PIPELINE' ? (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <header className="mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-2">Project Pipeline</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg">Process and match your RFQs natively.</p>
              </header>

              {/* Pipeline Stepper */}
              <div className="flex justify-between items-center mb-12 relative px-4">
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-zinc-200 dark:bg-zinc-800 -z-10" />
                {STAGES.map((stage, index) => {
                  const isActive = currentStage === stage.id;
                  const isCompleted = STAGES.findIndex(s => s.id === currentStage) > index;
                  
                  return (
                    <div key={stage.id} className="flex flex-col items-center gap-2 bg-zinc-50 dark:bg-zinc-950 px-4">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                          isActive 
                            ? 'border-blue-500 bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/20' 
                            : isCompleted 
                              ? 'border-green-500 bg-green-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                        }`}
                      >
                        {isCompleted ? '✓' : index + 1}
                      </div>
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-500' : 'text-zinc-500'}`}>
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
                    {currentStage === 'INGESTION' && (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/10 transition-all group"
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept=".pdf,.txt" 
                          onChange={handleFileUpload}
                        />
                        <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">📄</div>
                        <h3 className="text-2xl font-semibold mb-2">Upload RFQ</h3>
                        <p className="text-zinc-500 mb-8 text-center max-w-sm">
                          Drag and drop your RFQ document (PDF or Text) here, or click to browse.
                        </p>
                        <div className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                          Select File
                        </div>
                      </div>
                    )}

                    {currentStage === 'ANALYSIS' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                          <h3 className="text-2xl font-bold">Agent Analysis: {currentProject?.name}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="lg:col-span-2 space-y-6">
                            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-2xl">
                              <h4 className="font-semibold mb-4 text-zinc-500 uppercase text-[10px] tracking-widest">System Thought Log</h4>
                              <div className="space-y-2 font-mono text-sm h-64 overflow-y-auto">
                                {thoughtLog.map((log, i) => (
                                  <motion.p 
                                    key={i}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={log.includes('ambiguity') ? 'text-amber-400' : log.includes('complete') ? 'text-green-400' : 'text-zinc-400'}
                                  >
                                    {log}
                                  </motion.p>
                                ))}
                                {isProcessing && (
                                  <motion.span 
                                    animate={{ opacity: [0, 1, 0] }} 
                                    transition={{ repeat: Infinity, duration: 0.8 }}
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
                                    <h4 className="font-bold text-amber-900 dark:text-amber-100">Clarification Needed</h4>
                                  </div>
                                  <p className="text-amber-800 dark:text-amber-300 mb-6 text-sm leading-relaxed">
                                    {clarification}
                                  </p>
                                  <div className="space-y-3">
                                    <input 
                                      type="text" 
                                      value={humanAnswer}
                                      onChange={(e) => setHumanAnswer(e.target.value)}
                                      placeholder="Type your answer..."
                                      className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                    />
                                    <button 
                                      onClick={handleClarificationSubmit}
                                      disabled={isProcessing}
                                      className="w-full bg-amber-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                                    >
                                      {isProcessing ? 'Thinking...' : 'Send to Agent'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStage === 'PLANNING' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                          <h3 className="text-2xl font-bold">Matchmaking Results</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {matchCandidates.map((candidate) => (
                            <div key={candidate.id} className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50">
                              <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">👤</div>
                                <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-bold">
                                  {candidate.match}%
                                </span>
                              </div>
                              <h4 className="font-bold mb-1">{candidate.name}</h4>
                              <p className="text-xs text-zinc-500 mb-4 italic">"{candidate.reason}"</p>
                              <div className="flex flex-wrap gap-1">
                                {candidate.skills.map((s: string) => (
                                  <span key={s} className="bg-white dark:bg-zinc-800 text-[9px] px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-700">{s}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-8 text-center">
                          <button 
                            onClick={() => setCurrentStage('OUTREACH')}
                            className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all"
                          >
                            Finalize Team & Notify
                          </button>
                        </div>
                      </div>
                    )}

                    {currentStage === 'OUTREACH' && (
                      <div className="flex flex-col items-center justify-center h-[400px] text-center">
                        <div className="text-8xl mb-6">🚀</div>
                        <h3 className="text-3xl font-bold mb-3">Outreach Started!</h3>
                        <button 
                          onClick={() => {
                            setCurrentStage('INGESTION');
                            setCurrentProject(null);
                            setMatchCandidates([]);
                          }}
                          className="text-blue-500 font-medium hover:underline"
                        >
                          Process another RFQ
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="employees"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <header className="mb-12 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Employee Database</h1>
                  <p className="text-zinc-500 dark:text-zinc-400 text-lg">Manage profiles used for matchmaking.</p>
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
                      <th className="px-4 py-3 font-bold">Years Of Experience</th>
                      <th className="px-4 py-3 font-bold">Past Industry Experience</th>
                      <th className="px-4 py-3 font-bold">Future Industry Wish</th>
                      <th className="px-4 py-3 font-bold">Skills</th>
                      <th className="px-4 py-3 font-bold">Certifications</th>
                      <th className="px-4 py-3 font-bold">Availability Status</th>
                      <th className="px-4 py-3 font-bold">Project Start</th>
                      <th className="px-4 py-3 font-bold">Project End</th>
                      <th className="px-4 py-3 font-bold">CV</th>
                      <th className="px-4 py-3 font-bold">LinkedIn</th>
                      <th className="px-4 py-3 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">{emp.id}</td>
                        <td className="px-4 py-3">{emp.email}</td>
                        <td className="px-4 py-3 font-medium">{emp.firstName}</td>
                        <td className="px-4 py-3 font-medium">{emp.lastName}</td>
                        <td className="px-4 py-3">{emp.location}</td>
                        <td className="px-4 py-3">{emp.role}</td>
                        <td className="px-4 py-3">{emp.level}</td>
                        <td className="px-4 py-3">{emp.yearsOfExperience}</td>
                        <td className="px-4 py-3">{(emp.pastIndustryExperience || []).join(', ')}</td>
                        <td className="px-4 py-3">{(emp.futureIndustryWish || []).join(', ')}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(emp.skills || []).map((s: string) => (
                              <span key={s} className="bg-zinc-50 dark:bg-zinc-950 text-[10px] px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 font-medium whitespace-nowrap">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">{(emp.certifications || []).join(', ')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${emp.availabilityStatus === 'Available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {emp.availabilityStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">{emp.projectStart}</td>
                        <td className="px-4 py-3">{emp.projectEnd}</td>
                        <td className="px-4 py-3">
                          {emp.cv ? (
                            <a href={emp.cv} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View CV</a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {emp.linkedin ? (
                            <a href={emp.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Profile</a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
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
                      <h3 className="text-2xl font-bold mb-6">Edit Employee Profile</h3>
                      <form onSubmit={handleUpdateEmployee} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">First Name</label>
                            <input
                              type="text"
                              value={editingEmployee.firstName}
                              onChange={(e) => setEditingEmployee({...editingEmployee, firstName: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Last Name</label>
                            <input
                              type="text"
                              value={editingEmployee.lastName}
                              onChange={(e) => setEditingEmployee({...editingEmployee, lastName: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Email</label>
                          <input
                            type="email"
                            value={editingEmployee.email}
                            onChange={(e) => setEditingEmployee({...editingEmployee, email: e.target.value})}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Location</label>
                            <input
                              type="text"
                              value={editingEmployee.location}
                              onChange={(e) => setEditingEmployee({...editingEmployee, location: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Level</label>
                            <input
                              type="text"
                              value={editingEmployee.level}
                              onChange={(e) => setEditingEmployee({...editingEmployee, level: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Role</label>
                            <input
                              type="text"
                              value={editingEmployee.role}
                              onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Years Of Experience</label>
                            <input
                              type="number"
                              value={editingEmployee.yearsOfExperience}
                              onChange={(e) => setEditingEmployee({...editingEmployee, yearsOfExperience: Number(e.target.value)})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Skills (comma separated)</label>
                          <input
                            type="text"
                            value={(editingEmployee.skills || []).join(', ')}
                            onChange={(e) => setEditingEmployee({...editingEmployee, skills: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Certifications (comma separated)</label>
                          <input
                            type="text"
                            value={(editingEmployee.certifications || []).join(', ')}
                            onChange={(e) => setEditingEmployee({...editingEmployee, certifications: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Past Industry Experience (comma separated)</label>
                            <input
                              type="text"
                              value={(editingEmployee.pastIndustryExperience || []).join(', ')}
                              onChange={(e) => setEditingEmployee({...editingEmployee, pastIndustryExperience: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Future Industry Wish (comma separated)</label>
                            <input
                              type="text"
                              value={(editingEmployee.futureIndustryWish || []).join(', ')}
                              onChange={(e) => setEditingEmployee({...editingEmployee, futureIndustryWish: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Availability Status</label>
                            <select
                              value={editingEmployee.availabilityStatus}
                              onChange={(e) => setEditingEmployee({...editingEmployee, availabilityStatus: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            >
                              <option value="Available">Available</option>
                              <option value="On Project">On Project</option>
                              <option value="Unavailable">Unavailable</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Project Start</label>
                            <input
                              type="date"
                              value={editingEmployee.projectStart}
                              onChange={(e) => setEditingEmployee({...editingEmployee, projectStart: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Project End</label>
                            <input
                              type="date"
                              value={editingEmployee.projectEnd}
                              onChange={(e) => setEditingEmployee({...editingEmployee, projectEnd: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">CV URL</label>
                            <input
                              type="text"
                              value={editingEmployee.cv}
                              onChange={(e) => setEditingEmployee({...editingEmployee, cv: e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">LinkedIn URL</label>
                            <input
                              type="text"
                              value={editingEmployee.linkedin}
                              onChange={(e) => setEditingEmployee({...editingEmployee, linkedin: e.target.value})}
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
