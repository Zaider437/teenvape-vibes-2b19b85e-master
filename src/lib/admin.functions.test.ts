import { describe, it, expect } from "vitest";
import { calculateCopySortOrder, DEFAULT_CATEGORY_ORDER } from "./admin.functions";

describe("DEFAULT_CATEGORY_ORDER", () => {
  it("contains the standard default categories", () => {
    expect(DEFAULT_CATEGORY_ORDER).toEqual([
      "all",
      "disposable",
      "device",
      "liquid",
      "consumable",
      "snus",
    ]);
  });
});

describe("calculateCopySortOrder", () => {
  it("never produces a fractional sort_order when adjacent products have consecutive numbers (e.g. 1128 and 1129)", () => {
    const products = [
      { id: "prod-1", sort_order: 1128 },
      { id: "prod-2", sort_order: 1129 },
    ];
    const result = calculateCopySortOrder(1128, products, "prod-1");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(1128);
    expect(result).not.toBe(1128.5);
  });

  it("places the new item between two products when gap is greater than 1", () => {
    const products = [
      { id: "prod-1", sort_order: 10 },
      { id: "prod-2", sort_order: 20 },
    ];
    const result = calculateCopySortOrder(10, products, "prod-1");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(15);
  });

  it("produces an integer when gap is odd and greater than 1 (e.g. 10 and 21)", () => {
    const products = [
      { id: "prod-1", sort_order: 10 },
      { id: "prod-2", sort_order: 21 },
    ];
    const result = calculateCopySortOrder(10, products, "prod-1");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(15);
  });

  it("handles when source item is the last item in category", () => {
    const products = [
      { id: "prod-1", sort_order: 10 },
      { id: "prod-2", sort_order: 20 },
    ];
    const result = calculateCopySortOrder(20, products, "prod-2");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(21);
  });

  it("handles copying to another category with existing products", () => {
    const targetProducts = [
      { id: "target-1", sort_order: 50 },
      { id: "target-2", sort_order: 100 },
    ];
    // source ID not in target products
    const result = calculateCopySortOrder(10, targetProducts, "foreign-id");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(101);
  });

  it("handles copying to an empty category or when products list is null", () => {
    expect(calculateCopySortOrder(10, [], "foreign-id")).toBe(10);
    expect(calculateCopySortOrder(10, null, "foreign-id")).toBe(10);
    expect(calculateCopySortOrder(null as any, null, "foreign-id")).toBe(0);
  });
});
