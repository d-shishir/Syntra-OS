import React, { useEffect, useState } from "react";
import { X, Copy, Check, FileText, Loader2, Info, BrainCircuit, Code, RefreshCw } from "lucide-react";

interface DocumentDetail {
  id: string;
  filename: string;
  content: string;
  extracted_json: Record<string, any> | null;
  file_size: number;
  created_at: string;
}

interface DocumentViewerProps {
  documentId: string | null;
  onClose: () => void;
  backendUrl: string;
}

type TabType = "text" | "json";

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  onClose,
  backendUrl,
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("text");

  useEffect(() => {
    if (!documentId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setDoc(null);
      setActiveTab("text"); // default to text view
      try {
        const res = await fetch(`${backendUrl}/documents/${documentId}`);
        if (!res.ok) {
          throw new Error("Failed to load document text contents.");
        }
        const data = await res.json();
        setDoc(data);
      } catch (err: any) {
        setError(err.message || "An error occurred while fetching details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [documentId, backendUrl]);

  const triggerExtraction = async () => {
    if (!documentId) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/documents/${documentId}/extract`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to extract structured data from document.");
      }
      const updatedDoc = await res.json();
      setDoc(updatedDoc);
      setActiveTab("json"); // automatically flip to JSON tab on success
    } catch (err: any) {
      setError(err.message || "Extraction execution failed.");
    } finally {
      setExtracting(false);
    }
  };

  const copyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!documentId) return null;

  const wordCount = doc ? doc.content.split(/\s+/).filter(Boolean).length : 0;
  const charCount = doc ? doc.content.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Click outside target */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-full bg-darkPanel border-l border-darkBorder flex flex-col shadow-2xl animate-slideLeft">
        {/* Header */}
        <div className="p-6 border-b border-darkBorder flex items-center justify-between bg-darkPanel/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neonTeal/10 flex items-center justify-center text-neonTeal border border-neonTeal/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-md">
                {doc ? doc.filename : "Loading document..."}
              </h3>
              <p className="text-xs text-darkMuted">AI Document Workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-darkMuted hover:text-white rounded-lg hover:bg-darkBorder/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        {doc && (
          <div className="px-6 bg-darkPanel/40 border-b border-darkBorder/80 flex items-center justify-between">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("text")}
                className={`py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "text"
                    ? "border-neonTeal text-neonTeal"
                    : "border-transparent text-darkMuted hover:text-gray-300"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Raw Text
              </button>
              <button
                onClick={() => setActiveTab("json")}
                className={`py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "json"
                    ? "border-neonIndigo text-neonIndigo"
                    : "border-transparent text-darkMuted hover:text-gray-300"
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                Structured JSON
              </button>
            </div>

            {/* Quick Extraction Trigger Action */}
            <button
              onClick={triggerExtraction}
              disabled={extracting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neonIndigo/10 hover:bg-neonIndigo hover:text-white border border-neonIndigo/20 text-neonIndigo disabled:opacity-50 transition-all"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Extracting...
                </>
              ) : doc.extracted_json ? (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Re-extract
                </>
              ) : (
                <>
                  <BrainCircuit className="w-3 h-3" />
                  Run AI Extraction
                </>
              )}
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-neonTeal animate-spin" />
              <p className="text-sm text-darkMuted">Extracting & fetching content stream...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 text-rose-400">
              <Info className="w-8 h-8" />
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={triggerExtraction}
                className="mt-2 px-4 py-2 bg-darkBorder text-white text-xs font-semibold rounded-lg hover:bg-darkBorder/80"
              >
                Retry Request
              </button>
            </div>
          ) : doc ? (
            <div className="space-y-6">
              
              {/* Active Loading Cover for background executions */}
              {extracting && (
                <div className="p-8 border border-neonIndigo/20 bg-darkPanel/50 rounded-xl flex flex-col items-center justify-center gap-3 animate-pulse">
                  <BrainCircuit className="w-8 h-8 text-neonIndigo animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-200">Analyzing layout structures...</p>
                    <p className="text-xs text-darkMuted mt-0.5">Calling LLM parser & structuring validation arrays</p>
                  </div>
                </div>
              )}

              {/* View Rendering based on Active Tab */}
              {!extracting && activeTab === "text" && (
                <div className="space-y-6">
                  {/* Info Stats Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-darkBg/50 border border-darkBorder rounded-xl text-xs">
                    <div>
                      <span className="text-darkMuted block">Word Count</span>
                      <span className="font-semibold text-gray-200 text-sm">{wordCount}</span>
                    </div>
                    <div>
                      <span className="text-darkMuted block">Char Count</span>
                      <span className="font-semibold text-gray-200 text-sm">{charCount}</span>
                    </div>
                    <div>
                      <span className="text-darkMuted block">Size</span>
                      <span className="font-semibold text-gray-200 text-sm">
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                      <button
                        onClick={() => copyToClipboard(doc.content)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-darkBorder/60 hover:bg-neonTeal hover:text-darkBg text-gray-300 border border-darkBorder transition-all"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Text
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Document Raw Text */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-darkMuted uppercase tracking-wider">
                      Extracted Raw Text
                    </span>
                    <div className="bg-darkBg/30 border border-darkBorder/60 rounded-xl p-5 overflow-x-auto font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap min-h-[300px]">
                      {doc.content}
                    </div>
                  </div>
                </div>
              )}

              {!extracting && activeTab === "json" && (
                <div className="space-y-6">
                  {doc.extracted_json ? (
                    <div className="space-y-4">
                      {/* JSON Header & Copy */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
                          <Code className="w-4 h-4 text-neonIndigo" />
                          Parsed JSON Output ({doc.extracted_json.document_type || "general"})
                        </span>
                        
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(doc.extracted_json, null, 2))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-darkBorder/60 hover:bg-neonIndigo hover:text-white text-gray-300 border border-darkBorder transition-all"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied JSON
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy JSON
                            </>
                          )}
                        </button>
                      </div>

                      {/* Display key properties in a visual UI cards grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {doc.extracted_json.document_type === "invoice" ? (
                          <>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl">
                              <span className="text-[10px] uppercase text-darkMuted block">Vendor</span>
                              <span className="font-semibold text-gray-100 text-sm">{doc.extracted_json.vendor || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl">
                              <span className="text-[10px] uppercase text-darkMuted block">Amount Due</span>
                              <span className="font-semibold text-neonTeal text-sm">
                                {doc.extracted_json.currency || "USD"} {doc.extracted_json.amount || "0.00"}
                              </span>
                            </div>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl">
                              <span className="text-[10px] uppercase text-darkMuted block">Invoice Number</span>
                              <span className="font-semibold text-gray-100 text-sm">{doc.extracted_json.invoice_number || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl">
                              <span className="text-[10px] uppercase text-darkMuted block">Billing Date</span>
                              <span className="font-semibold text-gray-100 text-sm">{doc.extracted_json.date || "N/A"}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl sm:col-span-2">
                              <span className="text-[10px] uppercase text-darkMuted block">Detected Title</span>
                              <span className="font-semibold text-gray-100 text-sm">{doc.extracted_json.title || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-darkBg/50 border border-darkBorder rounded-xl sm:col-span-2">
                              <span className="text-[10px] uppercase text-darkMuted block">AI Summary</span>
                              <p className="text-gray-300 text-xs mt-1 leading-relaxed">{doc.extracted_json.summary || "N/A"}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Raw Pre-formatted JSON View */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-darkMuted uppercase tracking-wider block">Raw JSON Payload</span>
                        <pre className="bg-darkBg/30 border border-darkBorder/60 rounded-xl p-5 overflow-x-auto font-mono text-xs leading-relaxed text-neonTeal whitespace-pre-wrap">
                          {JSON.stringify(doc.extracted_json, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center border border-dashed border-darkBorder rounded-xl bg-darkPanel/10 space-y-4">
                      <BrainCircuit className="w-10 h-10 text-darkMuted mx-auto animate-pulse" />
                      <div className="space-y-1">
                        <h4 className="font-semibold text-gray-200">No Structured Data Extracted</h4>
                        <p className="text-xs text-darkMuted max-w-sm mx-auto">
                          Convert this document text into clean, structured JSON keys using LLM categorization.
                        </p>
                      </div>
                      <button
                        onClick={triggerExtraction}
                        className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/80 text-white font-semibold text-xs rounded-lg shadow-lg shadow-neonIndigo/10 inline-flex items-center gap-1.5 transition-all"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        Extract Structured Data
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
