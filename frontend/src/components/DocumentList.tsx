import React, { useState } from "react";
import { FileText, HardDrive, Eye, LayoutGrid, List, Trash2, RotateCcw, Archive } from "lucide-react";
import { ClassificationBadge } from "./ClassificationBadge";
import { IndexingStatusBadge } from "./IndexingStatusBadge";
import { DocumentCard } from "./DocumentCard";

export interface DocumentMetadata {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  is_vectorized?: boolean;
  document_type?: string;
  extracted_json?: Record<string, any> | null;
}

interface DocumentListProps {
  documents: DocumentMetadata[];
  trashDocuments: DocumentMetadata[];
  onSelectDocument: (id: string) => void;
  onTrashDocument: (id: string) => void;
  onRestoreDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  isLoading: boolean;
  sidebarOpen?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  trashDocuments = [],
  onSelectDocument,
  onTrashDocument,
  onRestoreDocument,
  onDeleteDocument,
  isLoading,
  sidebarOpen = true,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [activeTab, setActiveTab] = useState<"active" | "trash">("active");

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

  const displayedDocs = activeTab === "active" ? documents : trashDocuments;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 bg-darkPanel/30 border border-darkBorder/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Selector & Grid Toggle Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-darkBorder/40 pb-3">
        {/* Active vs Trash Tab Toggle */}
        <div className="flex bg-darkBg/60 border border-darkBorder rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-neonTeal/15 text-neonTeal border border-neonTeal/20"
                : "text-darkMuted hover:text-gray-300 border border-transparent"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Active Library</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "active" ? "bg-neonTeal/20 text-neonTeal" : "bg-darkPanel/45 text-darkMuted"
            }`}>
              {documents.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("trash")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "trash"
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "text-darkMuted hover:text-gray-300 border border-transparent"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash Bin</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "trash" ? "bg-red-500/20 text-red-400" : "bg-darkPanel/45 text-darkMuted"
            }`}>
              {trashDocuments.length}
            </span>
          </button>
        </div>

        {/* View Layout Toggles */}
        <div className="flex gap-2 self-end sm:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              viewMode === "grid"
                ? "bg-neonTeal/15 text-neonTeal border-neonTeal/30"
                : "bg-darkPanel/20 text-darkMuted border-darkBorder hover:text-gray-300"
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              viewMode === "table"
                ? "bg-neonTeal/15 text-neonTeal border-neonTeal/30"
                : "bg-darkPanel/20 text-darkMuted border-darkBorder hover:text-gray-300"
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {displayedDocs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-darkBorder rounded-xl bg-darkPanel/10">
          <FileText className="w-8 h-8 text-darkMuted mx-auto mb-3" />
          <p className="text-gray-300 font-medium">
            {activeTab === "active" ? "No active documents" : "Trash bin is empty"}
          </p>
          <p className="text-xs text-darkMuted mt-1">
            {activeTab === "active" 
              ? "Upload a PDF to get started with text extraction" 
              : "Items moved to trash will appear here."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* Card Grid View */
        <div className={sidebarOpen 
          ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" 
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
        }>
          {displayedDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onSelectDocument={onSelectDocument}
              formatBytes={formatBytes}
              formatDate={formatDate}
              onTrash={onTrashDocument}
              onRestore={onRestoreDocument}
              onDelete={onDeleteDocument}
              isTrash={activeTab === "trash"}
            />
          ))}
        </div>
      ) : (
        /* Dense Table List View */
        <div className="overflow-hidden border border-darkBorder rounded-xl bg-darkPanel/20 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-darkBorder bg-darkPanel/40 text-xs font-semibold text-darkMuted uppercase tracking-wider">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6 hidden sm:table-cell">Size</th>
                  <th className="py-4 px-6 hidden md:table-cell">Classification</th>
                  <th className="py-4 px-6 hidden md:table-cell">Indexing</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder/50 text-sm">
                {displayedDocs.map((doc) => (
                  <tr 
                    key={doc.id}
                    className="hover:bg-darkPanel/40 transition-colors group"
                  >
                    <td className="py-4 px-6 font-medium text-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neonTeal/5 flex items-center justify-center text-neonTeal shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="truncate max-w-[200px] sm:max-w-xs block font-semibold text-gray-200 hover:text-white" title={doc.filename}>
                            {doc.filename}
                          </span>
                          <code className="text-[10px] text-darkMuted font-mono select-all block mt-0.5" title="Double click to copy UUID">
                            ID: {doc.id}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-darkMuted hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatBytes(doc.file_size)}
                      </div>
                    </td>
                    <td className="py-4 px-6 hidden md:table-cell">
                      <ClassificationBadge documentType={doc.document_type} />
                    </td>
                    <td className="py-4 px-6 hidden md:table-cell">
                      <IndexingStatusBadge
                        isVectorized={doc.is_vectorized}
                        indexingMethod={doc.extracted_json?.indexing_method}
                      />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        {activeTab === "active" ? (
                          <>
                            <button
                              onClick={() => onSelectDocument(doc.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-darkBorder/50 hover:bg-neonIndigo hover:text-white border border-darkBorder hover:border-neonIndigo transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </button>
                            <button
                              onClick={() => onTrashDocument(doc.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onRestoreDocument(doc.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neonTeal/10 hover:bg-neonTeal text-neonTeal hover:text-white border border-neonTeal/20 hover:border-neonTeal transition-all cursor-pointer"
                              title="Restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restore
                            </button>
                            <button
                              onClick={() => onDeleteDocument(doc.id)}
                              className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-600/30 hover:border-red-600 transition-all cursor-pointer"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
