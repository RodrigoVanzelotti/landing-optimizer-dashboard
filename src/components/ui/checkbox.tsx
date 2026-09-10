'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** Labeled checkbox in the shadcn-style of the other primitives. */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  className,
}: CheckboxProps): React.ReactElement {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex cursor-pointer select-none items-center gap-2 text-sm',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {label}
    </label>
  );
}
