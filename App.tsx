import React from 'react';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { Briefcase, FileText } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Hassan <span className="text-emerald-400">Job Finder</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                <span>Resume Generator Active</span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-8 max-w-7xl mx-auto w-full">
        <WorkflowBuilder />
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-600 text-sm">
          <p>Hassan Job Finder - AI Job Search Agent. Review applications before sending.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;