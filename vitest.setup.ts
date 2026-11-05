import { config } from "dotenv";
import path from "node:path";
import "@testing-library/jest-dom/vitest";

config({ path: path.resolve(__dirname, ".env.local"), quiet: true });

// jsdom has no ResizeObserver; antd's DatePicker (via rc-resize-observer)
// needs one to mount at all, even when never opened.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;
