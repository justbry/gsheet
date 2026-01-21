import { describe, it, expect } from "vitest";
import { WorkspaceSheets } from "../src/schemas";

describe("Schemas", () => {
  describe("WorkspaceSheets", () => {
    it("should have AGENT_BASE sheet", () => {
      expect(WorkspaceSheets.AGENT_BASE).toBe("AGENT_BASE");
    });

    it("should only have AGENT_BASE sheet (consolidated workspace)", () => {
      const keys = Object.keys(WorkspaceSheets);
      expect(keys).toHaveLength(1);
      expect(keys).toContain("AGENT_BASE");
    });
  });
});
