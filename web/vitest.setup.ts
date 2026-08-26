import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { mswServer } from "./src/testing/msw-server";

// Equipo lento: espera generosa en findBy/waitFor
configure({ asyncUtilTimeout: 10000 });

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
