/**
 * Build mapping from BOM A and BOM B column names: match by name (case-insensitive), first pair as key.
 * @param {string[]} colsA - Column names from BOM A
 * @param {string[]} colsB - Column names from BOM B
 * @returns {{ tc: string, sap: string, isKey: boolean }[]}
 */
export function buildDynamicMapping(colsA, colsB) {
    const lowerB = colsB.map((c) => c.toLowerCase());
    const mappings = [];
    for (let i = 0; i < colsA.length; i++) {
        const a = colsA[i];
        const j = lowerB.indexOf(a.toLowerCase());
        if (j >= 0) {
            mappings.push({ tc: a, sap: colsB[j], isKey: mappings.length === 0 });
        }
    }
    if (mappings.length === 0 && colsA.length > 0 && colsB.length > 0) {
        mappings.push({ tc: colsA[0], sap: colsB[0], isKey: true });
    }
    return mappings;
}
