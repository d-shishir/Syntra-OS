import React from "react";
import { FileText, Calendar, HardDrive, Eye } from "lucide-react";

export interface DocumentMetadata {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface DocumentListProps {
  documents: DocumentMetadata[];
  onSelectDocument: (id: string) => void;
  isLoading: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onSelectDocument,
  isLoading,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 bg-darkPanel/30 border border-darkBorder/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-darkBorder rounded-xl bg-darkPanel/10">
        <FileText className="w-8 h-8 text-darkMuted mx-auto mb-3" />
        <p className="text-gray-300 font-medium">No documents ingested yet</p>
        <p className="text-xs text-darkMuted mt-1">Upload a PDF to get started with text extraction</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-darkBorder rounded-xl bg-darkPanel/20 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-darkBorder bg-darkPanel/40 text-xs font-semibold text-darkMuted uppercase tracking-wider">
              <th className="py-4 px-6">Name</th>
              <th className="py-4 px-6 hidden sm:table-cell">Size</th>
              <th className="py-4 px-6 hidden md:table-cell">Ingested At</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-darkBorder/50 text-sm">
            {documents.map((doc) => (
              <tr 
                key={doc.id}
                className="hover:bg-darkPanel/40 transition-colors group"
              >
                <td className="py-4 px-6 font-medium text-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neonTeal/5 flex items-center justify-center text-neonTeal shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="truncate max-w-[200px] sm:max-w-xs md:max-w-sm block" title={doc.filename}>
                      {doc.filename}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6 text-darkMuted hidden sm:table-cell">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" />
                    {formatBytes(doc.file_size)}
                  </div>
                </td>
                <td className="py-4 px-6 text-darkMuted hidden md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(doc.created_at)}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onSelectDocument(doc.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-darkBorder/50 hover:bg-neonIndigo hover:text-white border border-darkBorder hover:border-neonIndigo transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
