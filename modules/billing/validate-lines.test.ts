import { describe, expect, it } from "vitest";
import { validateBillLines } from "./validate-lines";

describe("validateBillLines", () => {
  it("accepts valid lines", () => {
    expect(() =>
      validateBillLines([
        { item_id: "item-1", qty: 2, rate: 15.5 },
        { item_id: "item-2", qty: 1, rate: 0 },
      ])
    ).not.toThrow();
  });

  it("rejects missing item id", () => {
    expect(() =>
      validateBillLines([{ item_id: "", qty: 1, rate: 10 }])
    ).toThrowError("Each line must have an item");
  });

  it("rejects non-positive or non-finite quantities", () => {
    expect(() =>
      validateBillLines([{ item_id: "x", qty: 0, rate: 10 }])
    ).toThrowError("Qty must be greater than 0");
    expect(() =>
      validateBillLines([{ item_id: "x", qty: Number.NaN, rate: 10 }])
    ).toThrowError("Qty must be greater than 0");
  });

  it("rejects negative or non-finite rates", () => {
    expect(() =>
      validateBillLines([{ item_id: "x", qty: 1, rate: -1 }])
    ).toThrowError("Rate cannot be negative");
    expect(() =>
      validateBillLines([{ item_id: "x", qty: 1, rate: Number.POSITIVE_INFINITY }])
    ).toThrowError("Rate cannot be negative");
  });
});
