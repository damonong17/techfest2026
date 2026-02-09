(() => {
  const CC = window.CC;
  const { safeStr, normalizeHeader, pick, toNumberMaybe, simpleHash } = CC;

  function mapRowToJob(row, sourceLabel) {
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeHeader(k)] = v;
    }

    const title = pick(normalized, [
      "title","job title","job_title","jobtitle","position","role","designation",
    ]);

    const company = pick(normalized, [
      "company","company name","employer","organisation","organization",
    ]);

    const location = pick(normalized, [
      "location","job location","city","town","region","country",
    ]);

    const salary = pick(normalized, [
      "salary","salary range","pay","compensation","wage","monthly salary","annual salary",
    ]);

    const url = pick(normalized, ["url","link","job url","job link","apply link"]);

    const description = pick(normalized, [
      "description","job description","job_description","job_details","summary",
      "responsibilities","requirements","roles & responsibilities","roles and responsibilities",
    ]);

    const posted = pick(normalized, ["posted","posted date","date","created","created at"]);

    const skills = CC.extractSkillsFromText(`${title} ${description}`);

    const id = simpleHash(`${safeStr(title)}|${safeStr(company)}|${safeStr(location)}|${safeStr(url)}`);

    return {
      id,
      title: safeStr(title).trim(),
      company: safeStr(company).trim(),
      location: safeStr(location).trim(),
      salaryText: safeStr(salary).trim(),
      salaryNumber: toNumberMaybe(salary),
      url: safeStr(url).trim(),
      description: safeStr(description).trim(),
      posted: safeStr(posted).trim(),
      source: sourceLabel,
      skills,
    };
  }

  function isLikelyJob(job) {
    return job.title.length >= 2 && (job.company.length >= 2 || job.url.length > 0);
  }

  CC.mapRowToJob = mapRowToJob;
  CC.isLikelyJob = isLikelyJob;
})();