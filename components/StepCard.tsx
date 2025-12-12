import React from 'react';
import { WorkflowStep, StepStatus } from '../types';
import { CheckCircle2, Circle, Loader2, AlertCircle, FileText, Sparkles, Send, Database, FileJson, Globe, ExternalLink, Download } from 'lucide-react';

interface StepCardProps {
  step: WorkflowStep;
  index: number;
}

const getIconForType = (type: string) => {
  switch (type) {
    case 'analysis': return <FileText className="w-4 h-4" />;
    case 'generation': return <Sparkles className="w-4 h-4" />;
    case 'extraction': return <FileJson className="w-4 h-4" />;
    case 'simulation': return <Send className="w-4 h-4" />;
    case 'search': return <Globe className="w-4 h-4" />;
    default: return <Database className="w-4 h-4" />;
  }
};

export const StepCard: React.FC<StepCardProps> = ({ step, index }) => {
  const isPending = step.status === StepStatus.PENDING;
  const isRunning = step.status === StepStatus.RUNNING;
  const isCompleted = step.status === StepStatus.COMPLETED;
  const isError = step.status === StepStatus.ERROR;

  const handleDownloadStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!step.output) return;
    const blob = new Blob([step.output], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JobBot_Step_${index + 1}_${step.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`relative flex gap-4 p-4 rounded-xl border transition-all duration-300 ${
      isRunning ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/10' : 
      isCompleted ? 'bg-slate-800/50 border-green-500/30' : 
      isError ? 'bg-red-900/10 border-red-500/50' :
      'bg-slate-800/30 border-slate-700'
    }`}>
      {/* Connector Line */}
      <div className="absolute left-[27px] top-12 bottom-[-24px] w-0.5 bg-slate-700 last:hidden" style={{ display: 'none' /* Handled by parent container generally, simplified here */ }}></div>

      {/* Status Icon */}
      <div className="flex-shrink-0 mt-1">
        {isPending && <Circle className="w-6 h-6 text-slate-500" />}
        {isRunning && <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />}
        {isCompleted && <CheckCircle2 className="w-6 h-6 text-green-400" />}
        {isError && <AlertCircle className="w-6 h-6 text-red-400" />}
      </div>

      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-semibold text-sm ${
            isCompleted ? 'text-green-400' : isRunning ? 'text-blue-400' : 'text-slate-200'
          }`}>
            Step {index + 1}: {step.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 capitalize">
                {getIconForType(step.actionType)}
                {step.actionType}
            </span>
            {step.output && (
                <button 
                    onClick={handleDownloadStep}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="Download output"
                >
                    <Download className="w-4 h-4" />
                </button>
            )}
          </div>
        </div>
        
        <p className="text-sm text-slate-400 mb-3">{step.description}</p>

        {step.output && (
          <div className="mt-3 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
            <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-mono text-slate-400 uppercase">Output</span>
            </div>
            <div className="p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
                {step.output}
              </pre>
            </div>
            {/* Source Links */}
            {step.sources && step.sources.length > 0 && (
              <div className="px-3 py-2 bg-slate-950/50 border-t border-slate-800">
                <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {step.sources.map((source, i) => (
                    <a 
                      key={i}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline bg-blue-900/20 px-2 py-1 rounded border border-blue-500/20 transition-colors"
                    >
                      <span className="truncate max-w-[150px]">{source.title}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step.error && (
          <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-300">
            Error: {step.error}
          </div>
        )}
      </div>
    </div>
  );
};