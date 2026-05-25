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
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed. Please check the PDF.");
      }

      setStatusMsg({ type: "success", text: `Successfully ingested "${file.name}"!` });
      setFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "An unexpected error occurred." });
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
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
          isDragActive 
            ? "border-neonTeal bg-darkPanel/80 shadow-[0_0_15px_rgba(0,221,255,0.15)]" 
            : file 
              ? "border-neonIndigo bg-darkPanel/40 cursor-default" 
              : "border-darkBorder bg-darkPanel/20 hover:border-neonTeal/50 hover:bg-darkPanel/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />

        {file ? (
          <div className="text-center space-y-4 w-full max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo animate-pulse">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-200 truncate">{file.name}</p>
              <p className="text-xs text-darkMuted">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setFile(null)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-darkBorder/40 hover:bg-darkBorder/80 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={uploadFile}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-darkBg bg-neonTeal hover:bg-neonTeal/80 disabled:bg-neonTeal/40 rounded-lg shadow-lg shadow-neonTeal/10 flex items-center gap-1.5 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Ingest Document"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3 pointer-events-none">
            <div className="mx-auto w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-darkMuted group-hover:text-neonTeal transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-200">
                Drag & drop your PDF here, or <span className="text-neonTeal">browse</span>
              </p>
              <p className="text-xs text-darkMuted mt-1">Supports PDF files only up to 20MB</p>
            </div>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border animate-fadeIn ${
            statusMsg.type === "success"
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/20 border-rose-500/30 text-rose-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span className="text-sm font-medium">{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};
