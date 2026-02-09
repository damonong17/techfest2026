(() => {
  const CC = window.CC;

  const LS_KEYS = {
    userSkills: "careercompass.userSkills",
    cvSkills: "careercompass.cvSkills",
    cvFileName: "careercompass.cvFileName",
    applications: "careercompass.applications",
    saved: "careercompass.saved",
    rejected: "careercompass.rejected",
    viewMode: "careercompass.viewMode",
  };

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  CC.LS_KEYS = LS_KEYS;
  CC.readLS = readLS;
  CC.writeLS = writeLS;
})();