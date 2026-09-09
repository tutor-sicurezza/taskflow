import { useState, useCallback, ChangeEvent } from 'react';
import { Sanitizer } from '@/lib/sanitization';

type SanitizerFunction = (value: string) => string;

export function useSanitizedInput(
  initialValue: string = '',
  sanitizer: SanitizerFunction = Sanitizer.text
) {
  const [value, setValue] = useState<string>(sanitizer(initialValue));
  const [rawValue, setRawValue] = useState<string>(initialValue);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
      const newValue = typeof e === 'string' ? e : e.target.value;
      setRawValue(newValue);
      setValue(sanitizer(newValue));
    },
    [sanitizer]
  );

  const reset = useCallback(() => {
    setValue(sanitizer(initialValue));
    setRawValue(initialValue);
  }, [initialValue, sanitizer]);

  return {
    value,
    rawValue,
    setValue: handleChange,
    reset,
  };
}
