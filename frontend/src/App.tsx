import { useEffect, useState, useCallback } from "react";
import { FileUpload } from "./components/FileUpload";
import { DocumentList } from "./components/DocumentList";
import type { DocumentMetadata } from "./components/DocumentList";
import { DocumentViewer } from "./components/DocumentViewer";
import { Cpu, Server, Database, Sparkles } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/documents`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents.");
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="min-h-screen pb-16 flex flex-col">
      {/* Navbar / Header */}
      <header className="border-b border-darkBorder bg-darkPanel/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-neonTeal/10 flex items-center justify-center text-neonTeal border border-neonTeal/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-gray-200 tracking-wide flex items-center gap-1.5">
                IngestEngine
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neonIndigo/20 text-neonIndigo border border-neonIndigo/30">
                  RAG Core
                </span>
              </h1>
              <p className="text-[10px] text-darkMuted">Enterprise AI Document Pipeline</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              API Connected
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-6xl w-full mx-auto px-6 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Upload & System Stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-200">Upload PDF Document</h2>
              <p className="text-xs text-darkMuted mt-0.5">Ingest files into the pipeline database</p>
            </div>
            
            <FileUpload 
              onUploadSuccess={fetchDocuments}
              backendUrl={BACKEND_URL}
            />
          </div>

          {/* System status details */}
          <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4">
            <h3 className="text-xs font-semibold text-darkMuted uppercase tracking-wider">
              Pipeline Integration
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonTeal">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs text-gray-300 font-medium">API Endpoint</p>
                  <p className="text-[10px] text-darkMuted">FastAPI running on localhost:8000</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonIndigo">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs text-gray-300 font-medium">PostgreSQL Database</p>
                  <p className="text-[10px] text-darkMuted">DB: doc_ingest | Port: 5433</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-yellow-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs text-gray-300 font-medium">Vector Store Setup</p>
                  <p className="text-[10px] text-darkMuted">Ready for pgvector / embeddings</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Document Table list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-200">Ingested Library</h2>
              <p className="text-xs text-darkMuted mt-0.5">
                Browse metadata and preview extracted text segments
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-darkBorder/40 text-gray-300">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </span>
          </div>

          <DocumentList
            documents={documents}
            onSelectDocument={setSelectedDocId}
            isLoading={loading}
          />
        </div>
      </main>

      {/* Side preview Drawer */}
      <DocumentViewer
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        backendUrl={BACKEND_URL}
      />
    </div>
  );
}

export default App;
