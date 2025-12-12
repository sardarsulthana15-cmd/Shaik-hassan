import React, { useState, useCallback, useEffect } from 'react';
import { WorkflowStep, StepStatus, ExecutionContext } from '../types';
import { generateWorkflowPlan, executeWorkflowStep } from '../services/geminiService';
import { StepCard } from './StepCard';
import { Play, RefreshCw, MapPin, Briefcase, Zap, Clock, Download, FileDown, Link2, FileText, Globe2, Building2 } from 'lucide-react';
import { jsPDF } from "jspdf";

export const WorkflowBuilder: React.FC = () => {
  // State: Job Type and Location (Resume removed)
  const [location, setLocation] = useState('India');
  const [jobType, setJobType] = useState('');
  
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [seenCompanies, setSeenCompanies] = useState<string[]>([]);

  // Load seen jobs from local storage
  useEffect(() => {
    const stored = localStorage.getItem('hassan_job_seen_companies');
    if (stored) {
        try {
            setSeenCompanies(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }
  }, []);

  const handleGeneratePlan = async () => {
    if (!jobType.trim() || !location.trim()) {
        alert("Please enter a Job Type and Location.");
        return;
    }
    
    setIsPlanning(true);
    setWorkflowName(null);
    setSteps([]); 

    // Context for "Already Shown"
    const recentHistory = seenCompanies.slice(-50).join(', ');

    const goal = `
      ACT AS A "DIRECT JOB LINK" SPECIALIST NAMED "HASSAN JOB FINDER".
      
      OBJECTIVES:
      1. SEARCH: Find **20 DIRECT APPLICATION LINKS** for "${jobType}".
         - **TARGET DOMAINS**: boards.greenhouse.io, jobs.lever.co, jobs.ashbyhq.com, docs.google.com/forms, myworkdayjobs.com, bamboohr.com, **Company Career Pages**.
         - LOCATION: **INDIA** (Startups, MNCs, FAANG).
         - TIME: **LAST 3 DAYS ONLY**.
         - EXCLUDE: [${recentHistory}].
      2. ANALYZE: Extract keywords.
      3. WRITE: Generate a Cover Letter.
      
      REPORT RULES:
      - **CRITICAL**: DO NOT show jobs that are CLOSED or EXPIRED.
      - STRICTLY BAN: Naukri, Indeed, LinkedIn, Glassdoor.
      - I only want links where I can upload my resume immediately (ATS or Career Page).
    `;

    const inputData = `
      --- SEARCH CRITERIA ---
      Location: ${location} (Focus: INDIA)
      Job Keywords: ${jobType}
      Mode: AGGRESSIVE DIRECT SEARCH
      Allowed Hosts: Greenhouse, Lever, Ashby, BambooHR, Workday, Google Forms, Company Career Pages
      Banned Hosts: Naukri.com, Indeed.com, LinkedIn.com, Glassdoor.com
      Freshness: POSTED WITHIN LAST 3 DAYS
      Status: ACTIVE JOBS ONLY (Filter out Closed/Filled)
      Volume: 20+ ITEMS
    `;

    try {
      const plan = await generateWorkflowPlan(goal, inputData);
      
      const newSteps: WorkflowStep[] = plan.steps.map((s: any, i: number) => ({
        id: `step-${Date.now()}-${i}`,
        title: s.title,
        description: s.description,
        actionType: s.actionType,
        status: StepStatus.PENDING
      }));

      setWorkflowName(`Hassan Scout: ${jobType}`);
      setSteps(newSteps);
    } catch (error) {
      console.error("Failed to generate plan", error);
      alert("Failed to plan automation. Please check your API usage.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleRunWorkflow = useCallback(async () => {
    if (steps.length === 0 || isExecuting) return;

    setIsExecuting(true);
    
    setSteps(prev => prev.map(s => ({ 
      ...s, 
      status: StepStatus.PENDING, 
      output: undefined, 
      sources: undefined,
      error: undefined 
    })));

    const context: ExecutionContext = {
      originalInput: `
        Target Location: ${location} (India Priority)
        Job Type: ${jobType}
        Requirement: DIRECT LINKS ONLY (Greenhouse, Lever, Forms, Career Pages). NO CLOSED JOBS. LAST 3 DAYS.
      `,
      stepOutputs: {}
    };

    const newSteps = [...steps];
    let collectedCompanies: string[] = [];

    for (let i = 0; i < newSteps.length; i++) {
      newSteps[i] = { ...newSteps[i], status: StepStatus.RUNNING };
      setSteps([...newSteps]);

      try {
        const result = await executeWorkflowStep(newSteps[i], context);
        
        context.stepOutputs[newSteps[i].id] = result.output;
        newSteps[i] = { 
          ...newSteps[i], 
          status: StepStatus.COMPLETED, 
          output: result.output,
          sources: result.sources
        };

        // Capture company names from search steps only
        if (result.output && newSteps[i].actionType === 'search') {
            const lines = result.output.split('\n');
            lines.forEach(line => {
                if (line.includes(' - ') && line.length < 100) {
                    const parts = line.split(' - ');
                    if (parts[0] && parts[0].length > 2) collectedCompanies.push(parts[0].replace(/^\d+\.\s*/, '').trim());
                }
            });
        }

      } catch (err: any) {
        newSteps[i] = { ...newSteps[i], status: StepStatus.ERROR, error: err.message || "Unknown error" };
        setSteps([...newSteps]);
        setIsExecuting(false);
        return; 
      }
      
      setSteps([...newSteps]);
    }

    if (collectedCompanies.length > 0) {
        const updatedSeen = [...new Set([...seenCompanies, ...collectedCompanies])].slice(-200); 
        setSeenCompanies(updatedSeen);
        localStorage.setItem('hassan_job_seen_companies', JSON.stringify(updatedSeen));
    }

    setIsExecuting(false);
  }, [steps, location, jobType, isExecuting, seenCompanies]);

  const handleDownloadAll = () => {
    if (steps.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxLineWidth = pageWidth - (margin * 2);
    let cursorY = 20;

    // Helper to check page break
    const checkPageBreak = (heightNeeded: number) => {
        if (cursorY + heightNeeded > pageHeight - margin) {
            doc.addPage();
            cursorY = 20;
        }
    };

    // Helper to add text
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: string = '#000000') => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(color);
        
        const lines = doc.splitTextToSize(text, maxLineWidth);
        const heightNeeded = lines.length * (fontSize * 0.4); // approx line height scaling
        
        checkPageBreak(heightNeeded);
        doc.text(lines, margin, cursorY);
        cursorY += heightNeeded + (fontSize * 0.2);
    };

    // Header
    addText("HASSAN JOB FINDER REPORT", 16, true, '#047857'); 
    addText(`Generated: ${new Date().toLocaleString()}`, 10, false, '#64748b');
    addText(`Query: ${jobType}`, 12, true, '#1e293b');
    addText(`Location: ${location}`, 10, false, '#1e293b');
    cursorY += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    // Steps Content
    steps.forEach((step, i) => {
      checkPageBreak(30);
      
      // Step Title
      addText(`SECTION ${i + 1}: ${step.title.toUpperCase()}`, 12, true, '#0f172a');
      cursorY += 2;

      // Step Output
      if (step.output) {
          // Remove markdown symbols for cleaner PDF text
          const cleanOutput = step.output
              .replace(/\*\*/g, '')
              .replace(/###/g, '')
              .replace(/`/g, '');
          addText(cleanOutput, 10, false, '#334155');
      } else {
          addText("No output generated.", 10, false, '#94a3b8');
      }

      // Step Links
      if (step.sources && step.sources.length > 0) {
          cursorY += 5;
          checkPageBreak(step.sources.length * 8);
          addText("DIRECT LINKS FOUND:", 10, true, '#047857');
          
          step.sources.forEach(source => {
              doc.setFontSize(9);
              doc.setTextColor(37, 99, 235); // Blue
              
              // We use textWithLink if available, or just text + link area
              // Since types might vary, we'll try standard link annotation
              const linkText = `• ${source.title}`;
              const lines = doc.splitTextToSize(linkText, maxLineWidth);
              
              checkPageBreak(lines.length * 5);
              
              // Add text
              doc.text(lines, margin, cursorY);
              
              // Add Link annotation over the text area
              const textHeight = lines.length * 4;
              doc.link(margin, cursorY - 4, maxLineWidth, textHeight, { url: source.uri });
              
              cursorY += textHeight + 2;
          });
      }

      cursorY += 8;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;
    });

    doc.save(`Hassan_Job_Finder_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const clearHistory = () => {
      localStorage.removeItem('hassan_job_seen_companies');
      setSeenCompanies([]);
      alert("Search history cleared.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      
      {/* Left Panel: Job Configuration */}
      <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Link2 className="w-32 h-32 text-emerald-500" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 relative z-10">
            <Globe2 className="text-emerald-400 fill-emerald-400/20" />
            Hassan Job Finder
          </h2>
          <p className="text-xs text-slate-400 mb-6 relative z-10">
            Finds Direct Links (Startups, MNCs, FAANG) in India.
          </p>
          
          <div className="space-y-6 relative z-10">
            
            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                <input 
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-9 pr-3 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all shadow-inner"
                  placeholder="e.g. Bangalore, Remote India"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Job Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Job Type / Keywords
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                <input 
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-9 pr-3 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all shadow-inner"
                  placeholder="e.g. React Developer, Data Analyst"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 mt-2 bg-slate-900/50 p-3 rounded border border-slate-700/50">
                 <p className="text-[10px] text-emerald-400 flex items-center gap-2">
                   <Building2 className="w-3 h-3"/> 
                   <span>Priority: Greenhouse, Lever, Workday</span>
                 </p>
                 <p className="text-[10px] text-slate-400 flex items-center gap-2">
                   <Clock className="w-3 h-3"/> 
                   <span>Posted: Last 3 Days (Strict)</span>
                 </p>
                 <p className="text-[10px] text-blue-400 flex items-center gap-2">
                   <Link2 className="w-3 h-3"/> 
                   <span>Active Jobs Only (No Closed)</span>
                 </p>
              </div>
            </div>

             {/* History Stats */}
             <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
               <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase">Seen / Ignored</span>
                  <span className="text-sm font-bold text-slate-300">{seenCompanies.length} jobs</span>
               </div>
               <button 
                onClick={clearHistory}
                className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
               >
                 Reset
               </button>
            </div>

            <div className="pt-4">
                <button
                onClick={handleGeneratePlan}
                disabled={isPlanning || !jobType || !location}
                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                    isPlanning 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500/20'
                }`}
                >
                {isPlanning ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> PLANNING...</>
                ) : (
                    <><Zap className="w-4 h-4 fill-current" /> FIND ACTIVE DIRECT JOBS</>
                )}
                </button>
            </div>

          </div>
        </div>
      </div>

      {/* Right Panel: Execution Flow */}
      <div className="lg:col-span-8 flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden relative">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {workflowName || "Hassan Job Finder Standby"}
              {isExecuting && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>}
            </h2>
            <p className="text-xs text-slate-500">
              {steps.length > 0 ? `${steps.length} steps: Search -> Analyze -> Write` : 'Enter keywords to start...'}
            </p>
          </div>

          <div className="flex items-center gap-2">
             {steps.length > 0 && steps.some(s => s.status === StepStatus.COMPLETED) && (
                <button
                    onClick={handleDownloadAll}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-2"
                    title="Download PDF Report"
                >
                    <Download className="w-5 h-5" />
                    <span className="text-xs font-bold">PDF</span>
                </button>
             )}

             {steps.length > 0 && (
                <button
                onClick={handleRunWorkflow}
                disabled={isExecuting}
                className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                    isExecuting
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                }`}
                >
                {isExecuting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> WORKING...</>
                ) : (
                    <><Play className="w-4 h-4 fill-current" /> EXECUTE</>
                )}
                </button>
             )}
          </div>
        </div>

        {/* Steps Container */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 relative">
          {steps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 shadow-2xl border border-slate-700/50 relative">
                <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping"></div>
                <Globe2 className="w-10 h-10 text-emerald-500/50" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Hassan Job Finder</h3>
              <p className="text-sm max-w-md text-center text-slate-500">
                1. Enter Job Type (e.g. "Software Engineer") <br/>
                2. Confirm Location (Default: India) <br/>
                3. I'll find 20+ Direct Application Links (Active, Last 3 Days).
              </p>
            </div>
          ) : (
            <>
               <div className="absolute left-10 top-6 bottom-6 w-px bg-slate-800 pointer-events-none z-0"></div>
               {steps.map((step, index) => (
                 <StepCard key={step.id} step={step} index={index} />
               ))}
               
               {isExecuting && steps.every(s => s.status === StepStatus.COMPLETED) && (
                 <div className="flex flex-col gap-4 p-6 bg-emerald-950/30 border border-emerald-500/30 rounded-xl animate-fade-in text-emerald-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white">Report Ready</span>
                        <p className="text-xs text-emerald-400/80">Includes: Direct Application Links & Keywords.</p>
                      </div>
                    </div>
                    <div className="text-xs bg-black/20 p-3 rounded font-mono text-emerald-200/70 border border-emerald-500/10">
                      > Download the PDF report to see links.<br/>
                      > Copy the cover letter.<br/>
                      > Add keywords to your resume.
                    </div>
                    <button 
                        onClick={handleDownloadAll}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <FileDown className="w-5 h-5" />
                        DOWNLOAD PDF REPORT
                    </button>
                 </div>
               )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};