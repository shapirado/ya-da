"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import heIL from "antd/locale/he_IL";

// Keeps every antd component (DatePicker, etc.) RTL and in Hebrew, and
// matches antd's accent color to the app's own terracotta so date pickers
// don't look like a foreign widget bolted onto the design.
export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      direction="rtl"
      locale={heIL}
      theme={{
        token: {
          fontFamily: "var(--font-heebo), system-ui, sans-serif",
          colorPrimary: "#b85a36",
          borderRadius: 10,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
