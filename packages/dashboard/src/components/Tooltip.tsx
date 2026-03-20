import { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          padding: '6px 10px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          fontSize: 11,
          color: '#ccc',
          maxWidth: 300,
          whiteSpace: 'normal',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

interface TooltipFieldProps {
  label: string;
  tooltip: string;
  required?: boolean;
  children: React.ReactNode;
}

export function TooltipField({ label, tooltip, required, children }: TooltipFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--red)' }}>*</span>}
        <Tooltip text={tooltip}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--border-color)',
            fontSize: 9,
            cursor: 'help',
            color: 'var(--text-secondary)',
          }}>ⓘ</span>
        </Tooltip>
      </label>
      {children}
    </div>
  );
}
