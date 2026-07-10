import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Limpa o DOM entre os testes (sem isto, renders anteriores acumulam e
// getByRole encontra elementos duplicados).
afterEach(() => cleanup());
