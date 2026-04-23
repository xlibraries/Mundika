import { describe, expect, it } from "vitest";
import {
  assertCheckoutReturnUrlsAllowed,
  normalizeSiteRoot,
} from "./return-url-allowed";

describe("assertCheckoutReturnUrlsAllowed", () => {
  it("accepts paths under site root", () => {
    expect(() =>
      assertCheckoutReturnUrlsAllowed(
        "http://localhost:3000",
        "http://localhost:3000/account?billing=success",
        "http://localhost:3000/account?billing=canceled"
      )
    ).not.toThrow();
  });

  it("accepts site root with trailing slash normalized", () => {
    expect(() =>
      assertCheckoutReturnUrlsAllowed(
        "http://localhost:3000/",
        "http://localhost:3000/account",
        "http://localhost:3000/account"
      )
    ).not.toThrow();
  });

  it("accepts GitHub Pages style base path", () => {
    expect(() =>
      assertCheckoutReturnUrlsAllowed(
        "https://user.github.io/Mundika",
        "https://user.github.io/Mundika/account?billing=success",
        "https://user.github.io/Mundika/account?billing=canceled"
      )
    ).not.toThrow();
  });

  it("rejects foreign origins", () => {
    expect(() =>
      assertCheckoutReturnUrlsAllowed(
        "http://localhost:3000",
        "https://evil.test/phish",
        "http://localhost:3000/account?billing=canceled"
      )
    ).toThrowError("successUrl");
  });

  it("normalizeSiteRoot strips trailing slashes", () => {
    expect(normalizeSiteRoot("https://a.com/b/")).toBe("https://a.com/b");
  });
});
