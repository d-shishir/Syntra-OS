import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  if (!content) return null;

  // Split content by lines
  const lines = content.split("\n");

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Matches **bold** and `code`
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const tokens = text.split(regex);

    tokens.forEach((token, idx) => {
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={idx} className="font-bold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={idx}
            className="bg-darkPanel/80 border border-darkBorder/45 px-1 py-0.5 rounded font-mono text-[10.5px] text-neonTeal"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(token);
      }
    });

    return parts;
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Unordered bullet lists: starting with * or - or •
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const contentText = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
              <span className="text-neonIndigo shrink-0 mt-1">•</span>
              <span className="flex-1 leading-relaxed text-gray-300">{parseInline(contentText)}</span>
            </div>
          );
        }

        // 2. Ordered lists: starting with a digit followed by dot, e.g. 1.
        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (orderedMatch) {
          const num = orderedMatch[1];
          const contentText = orderedMatch[2];
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
              <span className="text-neonIndigo font-mono font-bold shrink-0 text-[10px]">{num}.</span>
              <span className="flex-1 leading-relaxed text-gray-300">{parseInline(contentText)}</span>
            </div>
          );
        }

        // 3. Headers: h3, h4, h5
        if (line.startsWith("### ")) {
          return (
            <h5 key={idx} className="text-xs font-bold text-gray-200 mt-2.5 mb-1">
              {parseInline(line.substring(4))}
            </h5>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h4 key={idx} className="text-sm font-bold text-gray-100 mt-3.5 mb-1">
              {parseInline(line.substring(3))}
            </h4>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h3 key={idx} className="text-base font-bold text-white mt-4 mb-2">
              {parseInline(line.substring(2))}
            </h3>
          );
        }

        // 4. Empty line spacing
        if (trimmed === "") {
          return <div key={idx} className="h-1.5" />;
        }

        // 5. Standard paragraph
        return (
          <p key={idx} className="leading-relaxed text-gray-300">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
};
