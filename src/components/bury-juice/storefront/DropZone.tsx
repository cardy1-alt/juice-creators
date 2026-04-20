import { useCallback, useRef, useState, type DragEvent } from 'react';

interface Props {
  id: string;
  label: string;
  helper: string;
  accept: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}

// Visible drag-and-drop upload zone. Click or drop a file. Shows the
// filename + size + thumbnail preview once something is picked.

export function DropZone({ id, label, helper, accept, file, error, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const setFile = useCallback(
    (f: File | null) => {
      onChange(f);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      if (f && f.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(f));
      }
    },
    [onChange, preview],
  );

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) setFile(f);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  const hasFile = !!file;
  const className = [
    'bj-dropzone',
    dragActive ? 'bj-dropzone--active' : '',
    hasFile ? 'bj-dropzone--filled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label className="bj-label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div
        className={className}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {hasFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
            {preview && (
              <img
                src={preview}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 14,
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 2 }}>
                {(file.size / 1024).toFixed(0)} KB · click to replace
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--r-input)',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--ink-60)',
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
              Drop {label.toLowerCase()} here, or click to browse
            </div>
            <div style={{ fontSize: 13 }}>{helper}</div>
          </>
        )}
      </div>
      {error && <div style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
