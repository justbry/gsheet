import { describe, it, expect } from "vitest";
import { WorkspaceSheets } from "../src/schemas";

describe("Schemas", () => {
  describe("WorkspaceSheets", () => {
    it("should be empty (AGENT_BASE removed in favor of AGENTSCAPE)", () => {
      const keys = Object.keys(WorkspaceSheets);
      expect(keys).toHaveLength(0);
    });
  });
});
