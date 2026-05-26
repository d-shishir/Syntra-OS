import React, { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface FileUploadProps {
  onUploadSuccess: () => void;
  backendUrl: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, backendUrl }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setStatusMsg(null);
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setStatusMsg({ type: "error", text: "Invalid file type. Only PDF documents are supported." });
      return;
    }
    // Limit to 20MB for safety
    if (selectedFile.size > 20 * 1024 * 1024) {
      setStatusMsg({ type: "error", text: "File size exceeds 20MB limit." });
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async () => {
    if (!file) return;

    setLoading(true);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${backendUrl}/upload-document`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "Upload failed. Please check the PDF.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch {
          errorMsg = `Server error ${response.status}: ${response.statusText || "Internal error occurred"}`;
        }
        throw new Error(errorMsg);
      }

      setStatusMsg({ type: "success", text: `Successfully ingested "${file.name}"!` });
      setFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setStatusMsg({ 
        type: "error", 
        text: err.message === "Failed to fetch" 
          ? "Cannot connect to Syntra OS backend. Please verify that the API server is active on port 8000." 
          : err.message || "An unexpected error occurred during document upload." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={file ? undefined : triggerFileInput}
        className={`relative border border-darkBorder/60 bg-darkPanel/25 p-8 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[220px] overflow-hidden ${
          isDragActive 
            ? "border-neonTeal/80 bg-darkPanel/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
            : file 
              ? "border-neonIndigo/50 bg-darkPanel/30 cursor-default" 
              : "hover:border-neonTeal/40 hover:bg-darkPanel/35"
        }`}
      >
        {/* Corner Telemetry crosshairs */}
        <span className="absolute top-1.5 left-2 font-mono text-[9px] text-neonTeal/30 select-none">[SYS_DRAG]</span>
        <span className="absolute top-2 right-2.5 font-mono text-[9px] text-neonTeal/40 select-none">+</span>
        <span className="absolute bottom-2 left-2.5 font-mono text-[9px] text-neonTeal/40 select-none">+</span>
        <span className="absolute bottom-2 right-2.5 font-mono text-[9px] text-neonTeal/40 select-none">+</span>

        {/* Radar Ring Sweeper Animations (visible during drag or upload loading) */}
        {(isDragActive || loading) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 rounded-full border border-neonTeal/10 relative">
              <div className="radar-line" />
              <div className="absolute inset-4 rounded-full border border-neonTeal/5 border-dashed" />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />

        {file ? (
          <div className="text-center space-y-4 w-full max-w-sm relative z-10">
            <div className="mx-auto w-12 h-12 rounded bg-neonIndigo/10 flex items-center justify-center text-neonIndigo border border-neonIndigo/20 animate-pulse">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-xs font-bold text-gray-200 truncate px-2">{file.name}</p>
              <p className="text-[10px] font-mono text-darkMuted uppercase">
                {(file.size / (1024 * 1024)).toFixed(2)} MB // TELEMETRY OK
              </p>
            </div>
            <div className="flex gap-2.5 justify-center pt-2">
              <button
                onClick={() => setFile(null)}
                disabled={loading}
                className="px-3.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 hover:text-white bg-darkBorder/30 hover:bg-darkBorder border border-darkBorder/60 transition-all cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={uploadFile}
                disabled={loading}
                className="px-3.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-darkBg bg-neonTeal hover:bg-neonTeal/85 disabled:bg-neonTeal/40 shadow-lg shadow-neonTeal/5 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Transmit Document"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 pointer-events-none relative z-10 py-2">
            <div className="mx-auto w-11 h-11 rounded border border-darkBorder/80 bg-darkBg/65 flex items-center justify-center text-darkMuted group-hover:text-neonTeal group-hover:border-neonTeal/30 transition-all duration-300">
              <Upload className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="font-display font-extrabold uppercase text-xs text-gray-200 tracking-wider">
                Load Data Payload
              </p>
              <p className="text-[9px] font-mono text-darkMuted uppercase tracking-widest mt-1">
                Drag PDF here or <span className="text-neonTeal font-bold">browse mainframe</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-none border animate-fadeIn font-mono text-[11px] ${
            statusMsg.type === "success"
              ? "bg-emerald-950/10 border-emerald-500/25 text-emerald-400"
              : "bg-rose-950/10 border-rose-500/25 text-rose-400"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed break-words flex-1">
            [{statusMsg.type.toUpperCase()}] {statusMsg.text}
          </span>
        </div>
      )}
    </div>
  );
};
