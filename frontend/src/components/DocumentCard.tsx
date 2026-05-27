import React from "react";
import { FileText, HardDrive, Calendar, Eye, Trash2, RotateCcw } from "lucide-react";
import type { DocumentMetadata } from "./DocumentList";
import { ClassificationBadge } from "./ClassificationBadge";
import { IndexingStatusBadge } from "./IndexingStatusBadge";

interface DocumentCardProps {
  doc: DocumentMetadata;
  onSelectDocument: (id: string) => void;
  formatBytes: (bytes: number) => string;
  formatDate: (dateStr: string) => string;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  isTrash?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  doc,
  onSelectDocument,
  formatBytes,
  formatDate,
  onTrash,
  onRestore,
  onDelete,
  isTrash = false,
}) => {
  return (
    <div
      className="p-5 bg-darkPanel/20 border border-darkBorder/80 hover:border-neonTeal/50 hover:bg-darkPanel/30 rounded-xl flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md hover:shadow-neonTeal/5 group relative"
    >
      {/* Corner Telemetry crosshairs */}
      <span className="absolute top-2 right-2.5 font-mono text-[9px] text-neonTeal/20 select-none">+</span>
      <span className="absolute bottom-2 left-2.5 font-mono text-[9px] text-neonTeal/20 select-none">+</span>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-neonTeal/5 flex items-center justify-center text-neonTeal shrink-0 group-hover:scale-105 transition-transform border border-neonTeal/15">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <h4 className="font-semibold text-gray-200 truncate pr-4 text-sm" title={doc.filename}>
            {doc.filename}
          </h4>
          <p className="text-[9px] font-mono text-darkMuted bg-darkBg/60 px-1.5 py-0.5 rounded border border-darkBorder/40 select-all w-fit font-semibold" title="Double click to copy Document UUID">
            ID: {doc.id}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-darkMuted">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              {formatBytes(doc.file_size)}
            </span>
            <span className="w-1 h-1 rounded-full bg-darkBorder" />
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(doc.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 pt-2">
        <ClassificationBadge documentType={doc.document_type} />
        <IndexingStatusBadge
          isVectorized={doc.is_vectorized}
          indexingMethod={doc.extracted_json?.indexing_method}
        />
      </div>

      <div className="flex items-center justify-between border-t border-darkBorder/40 pt-3 mt-1 gap-2">
        <span className="text-[9px] uppercase font-mono text-darkMuted">
          {isTrash ? "Trashed" : "Ingested"}
        </span>
        <div className="flex gap-2">
          {!isTrash ? (
            <>
              <button
                onClick={() => onSelectDocument(doc.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-neonIndigo/10 hover:bg-neonIndigo text-neonIndigo hover:text-white border border-neonIndigo/20 hover:border-neonIndigo transition-all cursor-pointer"
                title="Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              {onTrash && (
                <button
                  onClick={() => onTrash(doc.id)}
                  className="p-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(doc.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-neonTeal/10 hover:bg-neonTeal text-neonTeal hover:text-white border border-neonTeal/20 hover:border-neonTeal transition-all cursor-pointer"
                  title="Restore"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(doc.id)}
                  className="p-1.5 text-xs font-semibold rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-600/30 hover:border-red-600 transition-all cursor-pointer"
                  title="Delete Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

