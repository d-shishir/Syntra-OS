import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-[10px] font-mono font-bold text-darkMuted uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`form-input ${className}`}
          {...props}
        />
        {error && (
          <p className="text-[10px] font-mono text-red-400 mt-1 select-none">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
