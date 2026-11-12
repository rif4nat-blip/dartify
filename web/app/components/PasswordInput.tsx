"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
};

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  className = "",
  minLength,
  required,
  autoComplete,
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${className} pr-16`}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 hover:text-white"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
