import React, { useEffect, useState } from "react";
import { X, Copy, Check, FileText, Loader2, Info } from "lucide-react";

interface DocumentDetail {
  id: string;
  filename: string;
  content: string;
  file_size: number;
  created_at: string;
}

interface DocumentViewerProps {
  documentId: string | null;
  onClose: () => void;
  backendUrl: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  onClose,
  backendUrl,
}) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setDoc(null);
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

  const copyToClipboard = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.content);
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
            <div className="w-10 h-10 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-md">
                {doc ? doc.filename : "Loading document..."}
              </h3>
              <p className="text-xs text-darkMuted">Document Extraction Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-darkMuted hover:text-white rounded-lg hover:bg-darkBorder/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
            </div>
          ) : doc ? (
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
                    onClick={copyToClipboard}
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

              {/* Document Text */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-darkMuted uppercase tracking-wider">
                  Extracted Raw Text
                </span>
                <div className="bg-darkBg/30 border border-darkBorder/60 rounded-xl p-5 overflow-x-auto font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap min-h-[300px]">
                  {doc.content}
                </div>
              </div>

              {/* RAG Preview Section */}
              <div className="p-4 bg-neonIndigo/5 border border-neonIndigo/20 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-neonIndigo uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neonIndigo animate-ping" />
                  RAG Readiness Note
                </h4>
                <p className="text-xs text-darkMuted leading-relaxed">
                  This extracted document is stored in PostgreSQL. In the next phase, this text will automatically be chunked and converted into vector embeddings using a sentence-transformer model, enabling fast cosine-similarity searches.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
