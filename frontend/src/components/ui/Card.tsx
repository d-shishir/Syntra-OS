import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  header,
  footer,
  noPadding = false,
  ...props
}) => {
  return (
    <div className={`ui-card ${className}`} {...props}>
      {header && (
        <div className="border-b border-darkBorder/40 pb-3 mb-4 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={noPadding ? "" : "space-y-4"}>{children}</div>
      {footer && (
        <div className="border-t border-darkBorder/40 pt-3 mt-4 flex justify-end gap-2">
          {footer}
        </div>
      )}
    </div>
  );
};
