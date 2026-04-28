import { buildDynamicMapping } from "./dynamicMapping";

describe("buildDynamicMapping", () => {
    it("matches columns by name (case-insensitive) and sets first pair as key", () => {
        const colsA = ["Part Number", "Qty", "Revision"];
        const colsB = ["part number", "Quantity", "revision"];
        const result = buildDynamicMapping(colsA, colsB);
        expect(result).toHaveLength(2); // Part Number↔part number, Revision↔revision (Qty≠Quantity)
        expect(result[0]).toEqual({ tc: "Part Number", sap: "part number", isKey: true });
        expect(result[1]).toEqual({ tc: "Revision", sap: "revision", isKey: false });
    });

    it("returns empty array when both column lists are empty", () => {
        expect(buildDynamicMapping([], [])).toEqual([]);
    });

    it("falls back to first column pair as key when no names match", () => {
        const colsA = ["ColA", "ColB"];
        const colsB = ["X", "Y"];
        const result = buildDynamicMapping(colsA, colsB);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ tc: "ColA", sap: "X", isKey: true });
    });

    it("matches all columns when names align", () => {
        const colsA = ["a", "b", "c"];
        const colsB = ["A", "B", "C"];
        const result = buildDynamicMapping(colsA, colsB);
        expect(result).toHaveLength(3);
        expect(result[0].isKey).toBe(true);
        expect(result[1].isKey).toBe(false);
        expect(result[2].isKey).toBe(false);
        expect(result.map((m) => m.tc)).toEqual(["a", "b", "c"]);
        expect(result.map((m) => m.sap)).toEqual(["A", "B", "C"]);
    });

    it("only one column each: uses that pair as key", () => {
        const result = buildDynamicMapping(["id"], ["ID"]);
        expect(result).toEqual([{ tc: "id", sap: "ID", isKey: true }]);
    });
});
