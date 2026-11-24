'use client';

import { useState } from 'react';
import { ConfigProvider, DatePicker } from 'antd';
import heIL from 'antd/locale/he_IL';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/he';

dayjs.locale('he');

const FORMAT = 'DD/MM/YYYY';
// typing with dots, dashes or a short year also works
const TYPED = [FORMAT, 'D/M/YYYY', 'DD.MM.YYYY', 'D.M.YYYY', 'DD-MM-YYYY', 'DDMMYYYY'];

/** The app's look for Ant Design: accent colour, Rubik, the same field height and radius as `.input`. */
export const ANT_THEME = {
  token: {
    colorPrimary: '#3446C4',
    colorBorder: '#D5D6DE',
    colorText: '#17161C',
    colorTextPlaceholder: '#5C5A66',
    fontFamily: 'Rubik, system-ui, sans-serif',
    fontSize: 15,
    borderRadius: 10,
    controlHeight: 44,
  },
};

/** Hebrew, right-to-left Ant Design context. */
export function AntHe({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider direction="rtl" locale={heIL} theme={ANT_THEME}>
      {children}
    </ConfigProvider>
  );
}

type Props = {
  /** Posts the date as YYYY-MM-DD under this name (for server-action forms). */
  name?: string;
  /** Uncontrolled starting value, YYYY-MM-DD. */
  defaultValue?: string | null;
  /** Controlled value, YYYY-MM-DD ('' = empty). */
  value?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  /** false: no clear button (the field always has a date). */
  allowClear?: boolean;
  className?: string;
  ariaLabel?: string;
};

/** Date field: Ant Design picker in Hebrew, RTL, shown as dd/mm/yyyy. */
export function DateField({ name, defaultValue, value, onChange, min, max, allowClear = true, className = '', ariaLabel }: Props) {
  const [own, setOwn] = useState(defaultValue || '');
  const iso = value !== undefined ? value : own;
  const set = (v: string) => {
    if (value === undefined) setOwn(v);
    onChange?.(v);
  };

  return (
    <AntHe>
      <DatePicker
        value={iso ? dayjs(iso) : null}
        onChange={(d: Dayjs | null) => set(d ? d.format('YYYY-MM-DD') : '')}
        format={TYPED}
        placeholder="dd/mm/yyyy"
        minDate={min ? dayjs(min) : undefined}
        maxDate={max ? dayjs(max) : undefined}
        allowClear={allowClear}
        aria-label={ariaLabel}
        className={`!min-h-11 ${className}`}
      />
      {name && <input type="hidden" name={name} value={iso} />}
    </AntHe>
  );
}
