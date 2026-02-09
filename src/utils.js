(() => {
  const CC = window.CC;

  function safeStr(x) {
    if (x === null || x === undefined) return "";
    return String(x);
  }

  function normalizeHeader(h) {
    return safeStr(h).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function pick(obj, keys) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && safeStr(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

  function toNumberMaybe(s) {
    const t = safeStr(s).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    if (!t) return null;
    const n = Number(t[0]);
    return Number.isFinite(n) ? n : null;
  }

  function simpleHash(str) {
    // stable-ish hash for IDs (not cryptographic)
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  CC.safeStr = safeStr;
  CC.normalizeHeader = normalizeHeader;
  CC.pick = pick;
  CC.toNumberMaybe = toNumberMaybe;
  CC.simpleHash = simpleHash;
})();