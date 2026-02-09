(() => {
  const CC = window.CC;
  const { safeStr } = CC;

  const SKILL_LEXICON = [
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang", "rust", "kotlin", "swift", "php", "ruby", "scala",
    "react", "next.js", "node", "node.js", "express", "vue", "angular", "svelte", "html", "css", "tailwind",
    "sql", "postgres", "postgresql", "mysql", "mongodb", "redis", "spark", "hadoop", "pandas", "numpy",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "github actions", "linux",
    "machine learning", "deep learning", "pytorch", "tensorflow", "nlp", "computer vision",
    "excel", "powerbi", "tableau", "data analysis", "stakeholder", "communication", "presentation",
    "oauth", "jwt", "iam", "owasp",
  ];

  function extractSkillsFromText(text) {
    const t = safeStr(text).toLowerCase();
    const found = new Set();

    for (const raw of SKILL_LEXICON) {
      const skill = raw.toLowerCase();
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
      if (re.test(t)) found.add(raw);
    }

    if (/rest\s*api|restful/i.test(t)) found.add("REST API");
    if (/git\b/i.test(t)) found.add("Git");
    if (/agile\b|scrum\b/i.test(t)) found.add("Agile/Scrum");

    return Array.from(found);
  }

  function normalizeSkillsList(input) {
    return safeStr(input)
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  }

  function scoreMatch(userSkillsLower, jobSkills) {
    if (!jobSkills.length) return { score: 0, overlap: 0, total: 0 };
    const jobLower = jobSkills.map((s) => s.toLowerCase());
    const overlap = jobLower.filter((s) => userSkillsLower.includes(s)).length;
    const total = jobSkills.length;
    const score = Math.round((overlap / total) * 100);
    return { score, overlap, total };
  }

  function scoreClass(score) {
    if (score >= 70) return "good";
    if (score >= 40) return "warn";
    return "bad";
  }

  CC.SKILL_LEXICON = SKILL_LEXICON;
  CC.extractSkillsFromText = extractSkillsFromText;
  CC.normalizeSkillsList = normalizeSkillsList;
  CC.scoreMatch = scoreMatch;
  CC.scoreClass = scoreClass;
})();