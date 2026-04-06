"use client";

import { useId, useState } from "react";

export function UploadField({
  name,
  accept,
}: {
  name: string;
  accept?: string;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState("");

  return (
    <div className="upload-field">
      <input
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        className="upload-field__input"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />

      <div className="upload-field__surface">
        <label htmlFor={inputId} className="upload-field__button">
          Choose File
        </label>
        <span className={`upload-field__meta ${fileName ? "has-file" : ""}`}>
          {fileName || "200MB per file • CSV"}
        </span>
      </div>
    </div>
  );
}
