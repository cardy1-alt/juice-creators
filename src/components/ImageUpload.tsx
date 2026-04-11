import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadImage } from '../lib/upload';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder: 'logos' | 'campaigns';
  label?: string;
  shape?: 'square' | 'circle';
}

export default function ImageUpload({ value, onChange, folder, label, shape = 'square' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isCircle = shape === 'circle';

  return (
    <div>
      {label && (
        <p className="block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5">{label}</p>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Upload preview"
            className={`object-cover ${isCircle ? 'w-[80px] h-[80px] rounded-full' : 'w-full h-[140px] rounded-[10px]'}`}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white flex items-center justify-center text-[var(--ink-50)] hover:text-[var(--ink)]"
            style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.15)' }}
          >
            <X size={12} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`absolute bottom-1.5 right-1.5 px-2 py-1 rounded-[6px] bg-white/90 text-[11px] font-medium text-[var(--ink-60)] hover:bg-white`}
            style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.10)' }}
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center border border-dashed border-[rgba(42,32,24,0.20)] hover:border-[var(--terra)] transition-colors bg-[rgba(42,32,24,0.02)] ${
            isCircle ? 'w-[80px] h-[80px] rounded-full' : 'w-full h-[140px] rounded-[10px]'
          }`}
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Upload size={18} className="text-[var(--ink-35)] mb-1" />
              <span className="text-[12px] text-[var(--ink-35)]">{isCircle ? 'Logo' : 'Upload image'}</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-[12px] text-[var(--terra)] mt-1">{error}</p>}
    </div>
  );
}
