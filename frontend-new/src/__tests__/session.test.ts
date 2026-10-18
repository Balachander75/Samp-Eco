import { describe, it, expect, beforeEach } from "vitest";
import {
  persistAuthSession,
  readAuthToken,
  readAuthUser,
  clearAuthStorage,
} from "@/lib/session";

describe("Session management utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores and retrieves access token and user profile in localStorage when rememberMe is true", () => {
    const mockUser = { id: 1, name: "Admin User", userid: "Admin" };
    persistAuthSession("mock-jwt-token-123", mockUser, true);

    expect(readAuthToken()).toBe("mock-jwt-token-123");
    expect(readAuthUser()).toEqual(mockUser);
  });

  it("stores in sessionStorage when rememberMe is false", () => {
    const mockUser = { id: 2, name: "Guest User", userid: "Guest" };
    persistAuthSession("mock-session-token-456", mockUser, false);

    expect(readAuthToken()).toBe("mock-session-token-456");
    expect(readAuthUser()).toEqual(mockUser);
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("clears all tokens and profile on clearAuthStorage", () => {
    const mockUser = { id: 1, name: "Admin User", userid: "Admin" };
    persistAuthSession("mock-jwt-token-123", mockUser, true);
    clearAuthStorage();

    expect(readAuthToken()).toBeNull();
    expect(readAuthUser()).toBeNull();
  });
});
