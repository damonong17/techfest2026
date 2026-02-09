const { useEffect, useMemo, useRef, useState } = React;

function App() {
  const CC = window.CC;

  const DEFAULT_DATASETS = [
    "mycareersfuture.csv",
    "jobstreet.csv",
    "indeed.csv",
    "glassdoor.csv",
    "efinancialcareers.csv",
  ];

  const [tab, setTab] = useState("jobs"); // jobs | tracker | roadmap

  const [jobs, setJobs] = useState([]);
  const [loadInfo, setLoadInfo] = useState({ loaded: 0, rejected: 0, sources: [], status: "" });

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [techStack, setTechStack] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [userSkillsText, setUserSkillsText] = useState(() => CC.readLS(CC.LS_KEYS.userSkills, ""));
  const userSkillsLower = useMemo(() => CC.normalizeSkillsList(userSkillsText), [userSkillsText]);

  // CV/resume upload → extracted keywords
  const [cvFileName, setCvFileName] = useState(() => CC.readLS(CC.LS_KEYS.cvFileName, ""));
  const [cvSkills, setCvSkills] = useState(() => CC.readLS(CC.LS_KEYS.cvSkills, []));
  const [cvStatus, setCvStatus] = useState("");
  const cvInputRef = useRef(null);
  const cvSkillsLower = useMemo(() => (cvSkills || []).map((s) => String(s).toLowerCase()), [cvSkills]);

  // Extra job CSV uploads (in addition to bundled datasets)
  const [extraCsvSources, setExtraCsvSources] = useState([]); // array of source labels
  const extraCsvInputRef = useRef(null);

  // Combined skills used for matching
  const combinedSkillsLower = useMemo(() => {
    const set = new Set([...(userSkillsLower || []), ...(cvSkillsLower || [])].filter(Boolean));
    return Array.from(set);
  }, [userSkillsLower, cvSkillsLower]);

  const [saved, setSaved] = useState(() => new Set(CC.readLS(CC.LS_KEYS.saved, [])));
  const [rejected, setRejected] = useState(() => new Set(CC.readLS(CC.LS_KEYS.rejected, [])));
  const [applications, setApplications] = useState(() => CC.readLS(CC.LS_KEYS.applications, {}));
  const [viewMode, setViewMode] = useState(() => CC.readLS(CC.LS_KEYS.viewMode, "list"));
  const [swipeFeedback, setSwipeFeedback] = useState(null); // 'saved' | 'rejected' | null
  const [swipeLocked, setSwipeLocked] = useState(false);
  const [activeSwipeJobId, setActiveSwipeJobId] = useState(null);

  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => { CC.writeLS(CC.LS_KEYS.userSkills, userSkillsText); }, [userSkillsText]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.cvSkills, cvSkills); }, [cvSkills]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.cvFileName, cvFileName); }, [cvFileName]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.saved, Array.from(saved)); }, [saved]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.rejected, Array.from(rejected)); }, [rejected]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.viewMode, viewMode); }, [viewMode]);
  useEffect(() => { CC.writeLS(CC.LS_KEYS.applications, applications); }, [applications]);

  const sources = useMemo(() => {
    const set = new Set(jobs.map((j) => j.source).filter(Boolean));
    return ["all", ...Array.from(set).sort((a,b) => a.localeCompare(b))];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    const min = CC.toNumberMaybe(minSalary);
    const tech = techStack.trim().toLowerCase();

    return jobs.filter((j) => {
      if (sourceFilter !== "all" && j.source !== sourceFilter) return false;

      if (q) {
        const hay = `${j.title} ${j.company} ${j.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (loc) {
        if (!j.location.toLowerCase().includes(loc)) return false;
      }

      if (min !== null) {
        if (j.salaryNumber === null) return false;
        if (j.salaryNumber < min) return false;
      }

      if (tech) {
        const hay = `${j.title} ${j.description} ${j.skills.join(" ")}`.toLowerCase();
        if (!hay.includes(tech)) return false;
      }

      return true;
    });
  }, [jobs, query, location, minSalary, techStack, sourceFilter]);

  const savedJobs = useMemo(() => jobs.filter((j) => saved.has(j.id)), [jobs, saved]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  const skillCountsInSaved = useMemo(() => {
    const counts = new Map();
    for (const j of savedJobs) {
      for (const s of j.skills) {
        const key = s.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [savedJobs]);

  const roadmap = useMemo(() => {
    const baseJob = selectedJob || (savedJobs[0] || null);
    if (!baseJob) return { job: null, gaps: [], plan: [] };

    const gaps = baseJob.skills
      .filter((s) => !combinedSkillsLower.includes(s.toLowerCase()))
      .slice();

    gaps.sort((a, b) => {
      const ca = skillCountsInSaved.get(a.toLowerCase()) || 0;
      const cb = skillCountsInSaved.get(b.toLowerCase()) || 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b);
    });

    const weeks = 4;
    const plan = Array.from({ length: weeks }, (_, i) => ({ week: i + 1, items: [] }));
    gaps.forEach((skill, idx) => {
      plan[idx % weeks].items.push(skill);
    });

    return { job: baseJob, gaps, plan };
  }, [selectedJob, savedJobs, combinedSkillsLower, skillCountsInSaved]);

  function mergeJobs(existingJobs, newJobs) {
    const merged = [...existingJobs, ...newJobs];
    const seen = new Set();
    const deduped = [];
    for (const j of merged) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      deduped.push(j);
    }
    return deduped;
  }

  async function loadBundledDatasets() {
    setLoadInfo((p) => ({ ...p, status: "Loading bundled datasets…" }));

    let loaded = 0;
    let rejectedCount = 0;
    const newJobs = [];
    const newSources = [];

    for (const fname of DEFAULT_DATASETS) {
      try {
        const res = await fetch(`./data/${fname}`);
        if (!res.ok) continue;
        const text = await res.text();
        const sourceLabel = fname.replace(/\.(csv|txt)$/i, "");
        newSources.push(sourceLabel);

        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        const rows = parsed.data || [];
        for (const row of rows) {
          const job = CC.mapRowToJob(row, sourceLabel);
          if (CC.isLikelyJob(job)) {
            newJobs.push(job);
            loaded++;
          } else {
            rejectedCount++;
          }
        }
      } catch {
        // ignore missing/bad files
      }
    }

    setJobs((prev) => {
      const deduped = mergeJobs(prev, newJobs);
      if (!selectedJobId && deduped.length) setSelectedJobId(deduped[0].id);
      return deduped;
    });

    setLoadInfo((prev) => ({
      loaded: prev.loaded + loaded,
      rejected: prev.rejected + rejectedCount,
      sources: Array.from(new Set([...(prev.sources || []), ...newSources])).sort((a,b) => a.localeCompare(b)),
      status: "",
    }));
  }

  // Auto-load bundled CSVs on first load
  useEffect(() => {
    loadBundledDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function extractTextFromCvFile(file) {
    const name = (file?.name || "").toLowerCase();

    if (name.endsWith(".txt")) {
      return await file.text();
    }

    if (name.endsWith(".pdf")) {
      const ab = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: ab });
      const pdf = await loadingTask.promise;
      let out = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strings = content.items.map((it) => it.str).filter(Boolean);
        out += strings.join(" ") + "\n";
      }
      return out;
    }

    if (name.endsWith(".docx")) {
      const ab = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
      return result?.value || "";
    }

    try {
      return await file.text();
    } catch {
      return "";
    }
  }

  async function onCvSelected(e) {
    const file = (e.target.files && e.target.files[0]) ? e.target.files[0] : null;
    if (!file) return;

    setCvStatus("Reading file…");
    setCvFileName(file.name);

    try {
      const text = await extractTextFromCvFile(file);
      const extracted = CC.extractSkillsFromText(text);

      const words = CC.safeStr(text)
        .toLowerCase()
        .replace(/[^a-z0-9+.#\s]/g, " ")
        .split(/\s+/g)
        .filter((w) => w.length >= 3 && w.length <= 24);

      const stop = new Set([
        "the","and","for","with","that","this","from","have","has","are","was","were","will","your","you","our","their",
        "experience","skills","skill","project","projects","work","working","team","teams","role","roles","using","used","use",
        "develop","development","design","analysis","data","manage","management","support","responsible","responsibilities",
        "intern","internship","graduate","graduates","university","college","singapore",
      ]);

      const counts = new Map();
      for (const w of words) {
        if (stop.has(w)) continue;
        counts.set(w, (counts.get(w) || 0) + 1);
      }
      const topExtra = Array.from(counts.entries())
        .sort((a,b) => b[1]-a[1])
        .slice(0, 20)
        .map(([w]) => w);

      const combined = Array.from(new Set([...(extracted || []), ...topExtra]));
      setCvSkills(combined);
      setCvStatus(`Extracted ${combined.length} keywords from ${file.name}`);
    } catch (err) {
      console.error(err);
      setCvSkills([]);
      setCvStatus("Could not read that file. Try .pdf, .docx, or .txt");
    }
  }

  function clearCv() {
    setCvFileName("");
    setCvSkills([]);
    setCvStatus("");
    localStorage.removeItem(CC.LS_KEYS.cvSkills);
    localStorage.removeItem(CC.LS_KEYS.cvFileName);
    if (cvInputRef.current) cvInputRef.current.value = "";
  }

  function clearExtraCsvs() {
    if (!extraCsvSources.length) return;
    const removeSources = new Set(extraCsvSources);
    const removedIds = jobs.filter((j) => removeSources.has(j.source)).map((j) => j.id);
    const removedSet = new Set(removedIds);

    setJobs((prev) => prev.filter((j) => !removeSources.has(j.source)));
    setSaved((prev) => new Set(Array.from(prev).filter((id) => !removedSet.has(id))));
    setRejected((prev) => new Set(Array.from(prev).filter((id) => !removedSet.has(id))));
    setApplications((prev) => {
      const next = { ...(prev || {}) };
      for (const id of removedSet) delete next[id];
      return next;
    });

    if (selectedJobId && removedSet.has(selectedJobId)) {
      const remaining = jobs.filter((j) => !removeSources.has(j.source));
      setSelectedJobId(remaining[0]?.id || null);
    }

    setExtraCsvSources([]);
    if (extraCsvInputRef.current) extraCsvInputRef.current.value = "";
  }

  function onFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let loaded = 0;
    let rejectedCount = 0;
    const newJobs = [];
    const newSources = [];

    const readOne = (file) =>
      new Promise((resolve) => {
        const sourceLabel = file.name.replace(/\.(csv|txt)$/i, "");
        newSources.push(sourceLabel);

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          complete: (res) => {
            const rows = res.data || [];
            for (const row of rows) {
              const job = CC.mapRowToJob(row, sourceLabel);
              if (CC.isLikelyJob(job)) {
                newJobs.push(job);
                loaded++;
              } else {
                rejectedCount++;
              }
            }
            resolve();
          },
          error: () => resolve(),
        });
      });

    Promise.all(files.map(readOne)).then(() => {
      setExtraCsvSources((prev) => {
        const next = Array.from(new Set([...(prev || []), ...newSources]));
        next.sort((a, b) => a.localeCompare(b));
        return next;
      });

      setJobs((prev) => {
        const deduped = mergeJobs(prev, newJobs);
        if (!selectedJobId && deduped.length) setSelectedJobId(deduped[0].id);
        return deduped;
      });

      setExtraCsvSources((prev) => {
        const next = Array.from(new Set([...(prev || []), ...newSources]));
        next.sort((a, b) => a.localeCompare(b));
        return next;
      });

      setLoadInfo((prev) => ({
        loaded: prev.loaded + loaded,
        rejected: prev.rejected + rejectedCount,
        sources: Array.from(new Set([...(prev.sources || []), ...newSources])).sort((a,b) => a.localeCompare(b)),
        status: "",
      }));
    });
  }

  function clearExtraCsvs() {
    if (!extraCsvSources || !extraCsvSources.length) return;

    const sourcesToRemove = new Set(extraCsvSources);
    const removedIds = new Set(
      (jobs || []).filter((j) => sourcesToRemove.has(j.source)).map((j) => j.id)
    );

    setJobs((prev) => {
      const next = (prev || []).filter((j) => !sourcesToRemove.has(j.source));
      if (selectedJobId && removedIds.has(selectedJobId)) {
        setSelectedJobId(next[0]?.id || null);
      }
      return next;
    });

    if (removedIds.size) {
      setSaved((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) next.delete(id);
        return next;
      });

      setRejected((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) next.delete(id);
        return next;
      });

      setApplications((prev) => {
        const next = { ...(prev || {}) };
        for (const id of removedIds) delete next[id];
        return next;
      });
    }

    setExtraCsvSources([]);
    if (extraCsvInputRef.current) extraCsvInputRef.current.value = "";
  }

  function toggleSaved(jobId) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function rejectJob(jobId) {
    setRejected((prev) => {
      const next = new Set(prev);
      next.add(jobId);
      return next;
    });
  }

  function unrejectJob(jobId) {
    setRejected((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  }

  function setAppStatus(jobId, status) {
    setApplications((prev) => {
      const next = { ...prev };
      const existing = next[jobId] || { status: "Saved", notes: "", updatedAt: null };
      next[jobId] = { ...existing, status, updatedAt: new Date().toISOString() };
      return next;
    });
  }

  function setAppNotes(jobId, notes) {
    setApplications((prev) => {
      const next = { ...prev };
      const existing = next[jobId] || { status: "Saved", notes: "", updatedAt: null };
      next[jobId] = { ...existing, notes, updatedAt: new Date().toISOString() };
      return next;
    });
  }

  function clearAll() {
    if (!confirm("Clear loaded jobs, saved jobs, rejected jobs, and tracker data?")) return;
    setJobs([]);
    setLoadInfo({ loaded: 0, rejected: 0, sources: [], status: "" });
    setCvFileName("");
    setCvSkills([]);
    setCvStatus("");
    setSaved(new Set());
    setRejected(new Set());
    setApplications({});
    setSelectedJobId(null);
    setActiveSwipeJobId(null);
    localStorage.removeItem(CC.LS_KEYS.saved);
    localStorage.removeItem(CC.LS_KEYS.cvSkills);
    localStorage.removeItem(CC.LS_KEYS.cvFileName);
    localStorage.removeItem(CC.LS_KEYS.rejected);
    localStorage.removeItem(CC.LS_KEYS.applications);

    // Reload bundled datasets after clearing
    setTimeout(() => loadBundledDatasets(), 50);
  }

  const trackerRows = useMemo(() => {
    const rows = [];
    for (const [jobId, info] of Object.entries(applications)) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) continue;
      rows.push({ job, info });
    }
    rows.sort((a, b) => {
      const ta = a.info.updatedAt ? Date.parse(a.info.updatedAt) : 0;
      const tb = b.info.updatedAt ? Date.parse(b.info.updatedAt) : 0;
      return tb - ta;
    });
    return rows;
  }, [applications, jobs]);

  const hasJobs = jobs.length > 0;

  // Swipe queue: sort by highest match %, then show one-by-one.
  const swipeQueue = useMemo(() => {
    const arr = [...filteredJobs];
    arr.sort((a, b) => {
      const sa = CC.scoreMatch(combinedSkillsLower, a.skills).score;
      const sb = CC.scoreMatch(combinedSkillsLower, b.skills).score;
      if (sb !== sa) return sb - sa;
      const ca = `${a.company}`.toLowerCase();
      const cb = `${b.company}`.toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return `${a.title}`.toLowerCase().localeCompare(`${b.title}`.toLowerCase());
    });
    return arr.filter((j) => !saved.has(j.id) && !rejected.has(j.id));
  }, [filteredJobs, combinedSkillsLower, saved, rejected]);

  useEffect(() => {
    if (tab !== "jobs" || viewMode !== "swipe") return;
    if (swipeLocked) return;

    const first = swipeQueue[0] || null;
    if (!first) {
      setActiveSwipeJobId(null);
      return;
    }

    if (!activeSwipeJobId || !swipeQueue.some((j) => j.id === activeSwipeJobId)) {
      setActiveSwipeJobId(first.id);
    }
  }, [tab, viewMode, swipeQueue, swipeLocked, activeSwipeJobId]);

  const swipeJob = swipeQueue.find((j) => j.id === activeSwipeJobId) || swipeQueue[0] || null;

  const swipeReject = () => {
    if (!swipeJob || swipeLocked) return;
    setSwipeLocked(true);
    setSwipeFeedback("rejected");
    setTimeout(() => {
      rejectJob(swipeJob.id);
      setSwipeFeedback(null);
      setSwipeLocked(false);
    }, 400);
  };

  const swipeSave = () => {
    if (!swipeJob || swipeLocked) return;
    setSwipeLocked(true);
    setSwipeFeedback("saved");
    setTimeout(() => {
      toggleSaved(swipeJob.id);
      setAppStatus(swipeJob.id, "Saved");
      setSwipeFeedback(null);
      setSwipeLocked(false);
    }, 400);
  };

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <h1>CareerCompass <span className="kbd">demo</span></h1>
          <p>
            A website for fresh grads: merge job data from multiple CSV sources, filter roles, extract requirements, track applications,
            and generate an upskilling roadmap based on skill gaps.
          </p>
        </div>

        <div className="tabs">
          <button className={`tabBtn ${tab === "jobs" ? "active" : ""}`} onClick={() => setTab("jobs")}>Jobs</button>
          <button className={`tabBtn ${tab === "tracker" ? "active" : ""}`} onClick={() => setTab("tracker")}>Tracker</button>
          <button className={`tabBtn ${tab === "roadmap" ? "active" : ""}`} onClick={() => setTab("roadmap")}>Roadmap</button>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <h2>Data + Profile</h2>

          <div className="field">
            <label>Bundled job datasets (auto-loaded)</label>
            <input value={DEFAULT_DATASETS.join(", ")} readOnly />
            <div className="small" style={{ marginTop: 6 }}>
              {loadInfo.status ? <span className="kbd">{loadInfo.status}</span> : "These CSVs are included inside the project folder under data/."}
            </div>
          </div>

          <div className="field">
            <label>Upload additional job CSV files (optional, you can select multiple)</label>
            <input ref={extraCsvInputRef} type="file" accept=".csv,.txt" multiple onChange={onFilesSelected} />
            <div className="small">
              You can add extra datasets on top of the bundled ones.
            </div>
            {extraCsvSources.length ? (
              <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
                <div className="small">
                  Added CSVs: <span className="kbd">{extraCsvSources.join(", ")}</span>
                </div>
                <button
                  className="btn danger"
                  style={{ padding: "6px 10px", fontSize: 12, borderRadius: 999 }}
                  onClick={clearExtraCsvs}
                  type="button"
                  title="Remove the additional uploaded CSV datasets"
                >
                  Remove CSVs
                </button>
              </div>
            ) : null}
          </div>

          <div className="field">
            <label>Upload CV/resume (PDF, DOCX, or TXT) to auto-extract keywords</label>
            <input ref={cvInputRef} type="file" accept=".pdf,.docx,.txt" onChange={onCvSelected} />
            <div className="small">
              {cvStatus ? <span className="kbd">{cvStatus}</span> : "We extract text locally in your browser. Nothing is uploaded anywhere."}
            </div>
            {cvFileName ? (
              <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
                <div className="small">
                  Current CV: <span className="kbd">{cvFileName}</span>
                </div>
                <button
                  className="btn danger"
                  style={{ padding: "6px 10px", fontSize: 12, borderRadius: 999 }}
                  onClick={clearCv}
                  type="button"
                  title="Remove the current CV and extracted keywords"
                >
                  Remove CV
                </button>
              </div>
            ) : null}

            {(cvSkills && cvSkills.length) ? (
              <div className="tags" style={{ marginTop: 10 }}>
                {cvSkills.slice(0, 18).map((s) => (
                  <span key={s} className="tag">{s}</span>
                ))}
                {cvSkills.length > 18 ? <span className="tag">+{cvSkills.length - 18} more</span> : null}
              </div>
            ) : null}
          </div>

          <div className="twoCol" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Loaded jobs</label>
              <input value={jobs.length} readOnly />
            </div>
            <div className="field">
              <label>Sources detected</label>
              <input value={sources.length - 1} readOnly />
            </div>
          </div>

          <div className="field">
            <label>Optional: add extra skills manually (comma or newline separated)</label>
            <textarea
              value={userSkillsText}
              onChange={(e) => setUserSkillsText(e.target.value)}
              placeholder="Example: Python, SQL, C, etc."
            />
            <div className="small">
              Matching uses the union of CV keywords and anything you type here.
            </div>
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <button className="btn danger" onClick={clearAll}>Clear all</button>
            <div className="small">Saved: <b>{saved.size}</b> • Tracked: <b>{trackerRows.length}</b></div>
          </div>

          <div className="footer">
            Runs entirely in your browser. Saved jobs and tracker notes are stored in <span className="kbd">localStorage</span>.
          </div>
        </div>

        <div className="panel">
          {tab === "jobs" && (
            <>
              <h2>Jobs</h2>
              {!hasJobs ? (
                <div className="empty">
                  <b>Loading jobs…</b>
                  <div className="small" style={{ marginTop: 8 }}>
                    If this stays empty, make sure you are running it via a local server (Live Server).
                  </div>
                </div>
              ) : (
                <>
                  <div className="twoCol">
                    <div className="field">
                      <label>Search (title/company/description)</label>
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. data analyst, software engineer" />
                    </div>
                    <div className="field">
                      <label>Location</label>
                      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Singapore" />
                    </div>
                  </div>

                  <div className="twoCol">
                    <div className="field">
                      <label>Min salary (number, optional)</label>
                      <input value={minSalary} onChange={(e) => setMinSalary(e.target.value)} placeholder="e.g. 4000" />
                    </div>
                    <div className="field">
                      <label>Tech stack filter (keyword)</label>
                      <input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="e.g. React, AWS, Python" />
                    </div>
                  </div>

                  <div className="twoCol">
                    <div className="field">
                      <label>Source</label>
                      <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                        {sources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Showing</label>
                      <input value={`${filteredJobs.length} / ${jobs.length}`} readOnly />
                    </div>
                  </div>

                  <div className="twoCol">
                    <div className="field">
                      <label>View mode</label>
                      <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                        <option value="list">List</option>
                        <option value="swipe">Swipe</option>
                      </select>
                    </div>
                  </div>

                  <div className="hr" />

                  {viewMode === "list" ? (
                    <div className="cards">
                      {filteredJobs.slice(0, 50).map((j) => {
                        const m = CC.scoreMatch(combinedSkillsLower, j.skills);
                        const cls = CC.scoreClass(m.score);
                        const isSaved = saved.has(j.id);
                        const isRejected = rejected.has(j.id);
                        const app = applications[j.id];
                        return (
                          <div key={j.id} className="card">
                            <div className="cardTop">
                              <div>
                                <div className="row" style={{ gap: 10 }}>
                                  <h3 className="title">{j.title || "(Untitled role)"}</h3>
                                  <span className={`score ${cls}`}>{m.score}% match</span>
                                </div>
                                <div className="meta">
                                  {j.company ? <b>{j.company}</b> : "(Company unknown)"}
                                  {j.location ? <> • {j.location}</> : null}
                                  {j.source ? <> • <span className="kbd">{j.source}</span></> : null}
                                </div>
                              </div>

                              <div className="row" style={{ justifyContent: "flex-end" }}>
                                <button
                                  className={`btn ${isSaved ? "" : "primary"}`}
                                  onClick={() => toggleSaved(j.id)}
                                >
                                  {isSaved ? "Unsave" : "Save"}
                                </button>
                                <button
                                  className="btn"
                                  onClick={() => {
                                    setSelectedJobId(j.id);
                                    setTab("roadmap");
                                  }}
                                >
                                  Roadmap
                                </button>
                                <button className="btn danger" onClick={() => rejectJob(j.id)}>
                                  Reject
                                </button>
                                {isRejected ? (
                                  <button className="btn" onClick={() => unrejectJob(j.id)}>
                                    Undo reject
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            <div className="tags">
                              {j.salaryText ? <span className="tag">Salary: {j.salaryText}</span> : null}
                              {j.posted ? <span className="tag">Posted: {j.posted}</span> : null}
                              {app?.status ? <span className="tag">Status: {app.status}</span> : null}
                              {j.skills.slice(0, 6).map((s) => (
                                <span key={s} className="tag">{s}</span>
                              ))}
                              {j.skills.length > 6 ? <span className="tag">+{j.skills.length - 6} more</span> : null}
                            </div>

                            <div className="hr" />

                            <div className="twoCol">
                              <div>
                                <div className="small"><b>Transparent requirements (auto-extracted)</b></div>
                                <div className="small" style={{ marginTop: 6 }}>
                                  {j.skills.length ? j.skills.join(", ") : "No skills detected. (Try improving your dataset's description column.)"}
                                </div>
                              </div>
                              <div>
                                <div className="small"><b>Quick actions</b></div>
                                <div className="row" style={{ marginTop: 8 }}>
                                  <button className="btn" onClick={() => setAppStatus(j.id, "Saved")}>Saved</button>
                                  <button className="btn" onClick={() => setAppStatus(j.id, "Applied")}>Applied</button>
                                  <button className="btn" onClick={() => setAppStatus(j.id, "Interview")}>Interview</button>
                                  <button className="btn" onClick={() => setAppStatus(j.id, "Offer")}>Offer</button>
                                  <button className="btn" onClick={() => setAppStatus(j.id, "Rejected")}>Rejected</button>
                                </div>
                              </div>
                            </div>

                            {j.url ? (
                              <div className="small" style={{ marginTop: 10 }}>
                                Link: <a href={j.url} target="_blank" rel="noreferrer" className="kbd">Open posting</a>
                              </div>
                            ) : null}

                            {j.description ? (
                              <details style={{ marginTop: 10 }}>
                                <summary className="small" style={{ cursor: "pointer" }}>Show description</summary>
                                <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                                  {j.description.slice(0, 1200)}{j.description.length > 1200 ? "…" : ""}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}

                      {filteredJobs.length > 50 ? (
                        <div className="empty">
                          Showing the first <b>50</b> results for performance. Tighten filters to see other jobs.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="cards">
                      <div className="card">
                        <div className="small" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <b>Swipe mode</b> • sorted by highest match first • remaining: <span className="kbd">{swipeQueue.length}</span>
                          </div>
                          <div className="small">Use the ✕ / ✓ buttons</div>
                        </div>
                      </div>

                      {!swipeJob ? (
                        <div className="empty">
                          No more jobs in the swipe queue.
                          <div className="small" style={{ marginTop: 8 }}>
                            Try loosening filters, or clear rejected jobs by clicking <b>Clear all</b> (left panel).
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const m = CC.scoreMatch(combinedSkillsLower, swipeJob.skills);
                          const cls = CC.scoreClass(m.score);
                          return (
                            <div className="card" style={{ padding: 18, position: "relative" }}>
                              {swipeFeedback ? (
                                <div className="swipeOverlay">
                                  <div className={`swipeBubble ${swipeFeedback === "saved" ? "save" : "reject"}`}>
                                    {swipeFeedback === "saved" ? "✓" : "✕"}
                                  </div>
                                </div>
                              ) : null}
                              <div className="cardTop">
                                <div>
                                  <div className="row" style={{ gap: 10 }}>
                                    <h3 className="title" style={{ fontSize: 18 }}>{swipeJob.title || "(Untitled role)"}</h3>
                                    <span className={`score ${cls}`}>{m.score}% match</span>
                                  </div>
                                  <div className="meta">
                                    {swipeJob.company ? <b>{swipeJob.company}</b> : "(Company unknown)"}
                                    {swipeJob.location ? <> • {swipeJob.location}</> : null}
                                    {swipeJob.source ? <> • <span className="kbd">{swipeJob.source}</span></> : null}
                                  </div>
                                </div>

                                <div className="swipeBtns">
                                  <button className="swipeBtn reject" onClick={swipeReject} disabled={swipeLocked} title="Reject">
                                    ✕
                                  </button>
                                  <button className="swipeBtn save" onClick={swipeSave} disabled={swipeLocked} title="Save">
                                    ✓
                                  </button>
                                </div>
                              </div>

                              <div className="tags" style={{ marginTop: 12 }}>
                                {swipeJob.salaryText ? <span className="tag">Salary: {swipeJob.salaryText}</span> : null}
                                {swipeJob.posted ? <span className="tag">Posted: {swipeJob.posted}</span> : null}
                                {swipeJob.skills.slice(0, 10).map((s) => (
                                  <span key={s} className="tag">{s}</span>
                                ))}
                                {swipeJob.skills.length > 10 ? <span className="tag">+{swipeJob.skills.length - 10} more</span> : null}
                              </div>

                              <div className="hr" />

                              <div className="twoCol">
                                <div>
                                  <div className="small"><b>Transparent requirements (auto-extracted)</b></div>
                                  <div className="small" style={{ marginTop: 6 }}>
                                    {swipeJob.skills.length ? swipeJob.skills.join(", ") : "No skills detected. (Try improving your dataset's description column.)"}
                                  </div>
                                </div>
                                <div>
                                  <div className="small"><b>Actions</b></div>
                                  <div className="row" style={{ marginTop: 8 }}>
                                    <button className="btn" onClick={() => { setSelectedJobId(swipeJob.id); setTab("roadmap"); }}>
                                      Build roadmap
                                    </button>
                                    <button className="btn" onClick={() => setAppStatus(swipeJob.id, "Applied")}>Mark applied</button>
                                    <button className="btn" onClick={() => setAppStatus(swipeJob.id, "Interview")}>Mark interview</button>
                                  </div>
                                </div>
                              </div>

                              {swipeJob.url ? (
                                <div className="small" style={{ marginTop: 10 }}>
                                  Link: <a href={swipeJob.url} target="_blank" rel="noreferrer" className="kbd">Open posting</a>
                                </div>
                              ) : null}

                              {swipeJob.description ? (
                                <details style={{ marginTop: 10 }} open>
                                  <summary className="small" style={{ cursor: "pointer" }}>Show description</summary>
                                  <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                                    {swipeJob.description.slice(0, 1400)}{swipeJob.description.length > 1400 ? "…" : ""}
                                  </div>
                                </details>
                              ) : null}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === "tracker" && (
            <>
              <h2>Application tracker</h2>
              {!trackerRows.length ? (
                <div className="empty">
                  No tracked applications yet. Go to <b>Jobs</b> and click a status button (Applied/Interview/etc.).
                </div>
              ) : (
                <div className="cards">
                  {trackerRows.map(({ job, info }) => (
                    <div key={job.id} className="card">
                      <div className="cardTop">
                        <div>
                          <h3 className="title">{job.title}</h3>
                          <div className="meta">
                            <b>{job.company}</b> {job.location ? <>• {job.location}</> : null} • <span className="kbd">{job.source}</span>
                          </div>
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <span className="tag">Status: <b>{info.status}</b></span>
                          <button className="btn" onClick={() => { setSelectedJobId(job.id); setTab("roadmap"); }}>Roadmap</button>
                        </div>
                      </div>

                      <div className="hr" />

                      <div className="twoCol">
                        <div>
                          <div className="small"><b>Update status</b></div>
                          <div className="row" style={{ marginTop: 8 }}>
                            {["Saved", "Applied", "Interview", "Offer", "Rejected"].map((s) => (
                              <button key={s} className="btn" onClick={() => setAppStatus(job.id, s)}>{s}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="small"><b>Notes</b></div>
                          <textarea
                            style={{ marginTop: 8 }}
                            value={info.notes || ""}
                            onChange={(e) => setAppNotes(job.id, e.target.value)}
                            placeholder="Interview time, recruiter name, what to follow up on, etc."
                          />
                        </div>
                      </div>

                      {info.updatedAt ? (
                        <div className="small" style={{ marginTop: 10 }}>
                          Last updated: <span className="kbd">{new Date(info.updatedAt).toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "roadmap" && (
            <>
              <h2>Upskilling roadmap</h2>
              {!hasJobs ? (
                <div className="empty">Upload jobs first, then pick a job to generate a roadmap.</div>
              ) : (
                <>
                  <div className="twoCol">
                    <div className="field">
                      <label>Choose a job (uses your saved jobs first)</label>
                      <select
                        value={selectedJobId || ""}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                      >
                        {[...savedJobs, ...jobs.filter((j) => !saved.has(j.id))]
                          .slice(0, 200)
                          .map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.title} — {j.company}{j.location ? ` (${j.location})` : ""}
                            </option>
                          ))}
                      </select>
                      <div className="small">
                        Tip: Save a few jobs you like so the roadmap can prioritize the most common skills.
                      </div>
                    </div>

                    <div className="field">
                      <label>Roadmap mode</label>
                      <input value="4-week sprint plan (auto)" readOnly />
                      <div className="small">
                        This demo spreads missing skills across 4 weeks. You can extend it later with course links.
                      </div>
                    </div>
                  </div>

                  {!roadmap.job ? (
                    <div className="empty">No job selected.</div>
                  ) : (
                    <>
                      <div className="hr" />

                      <div className="card">
                        <div className="cardTop">
                          <div>
                            <h3 className="title">Target: {roadmap.job.title}</h3>
                            <div className="meta">
                              <b>{roadmap.job.company}</b> {roadmap.job.location ? <>• {roadmap.job.location}</> : null} • <span className="kbd">{roadmap.job.source}</span>
                            </div>
                          </div>
                          <div className="row" style={{ justifyContent: "flex-end" }}>
                            <button className="btn" onClick={() => toggleSaved(roadmap.job.id)}>
                              {saved.has(roadmap.job.id) ? "Unsave" : "Save"}
                            </button>
                            <button className="btn" onClick={() => setTab("jobs")}>Back to jobs</button>
                          </div>
                        </div>

                        <div className="hr" />

                        <div className="twoCol">
                          <div>
                            <div className="small"><b>Detected requirements</b></div>
                            <div className="tags" style={{ marginTop: 8 }}>
                              {roadmap.job.skills.length ? roadmap.job.skills.map((s) => (
                                <span key={s} className="tag">{s}</span>
                              )) : <span className="tag">(None detected)</span>}
                            </div>
                          </div>
                          <div>
                            <div className="small"><b>Skill gaps (what you can learn next)</b></div>
                            <div className="tags" style={{ marginTop: 8 }}>
                              {roadmap.gaps.length ? roadmap.gaps.map((s) => (
                                <span key={s} className="tag">{s}</span>
                              )) : <span className="tag">No gaps! (Based on your current skills)</span>}
                            </div>
                          </div>
                        </div>

                        <div className="hr" />

                        <div className="twoCol">
                          {roadmap.plan.map((w) => (
                            <div key={w.week} className="card" style={{ background: "rgba(255,255,255,0.05)" }}>
                              <div className="small"><b>Week {w.week}</b></div>
                              <div className="small" style={{ marginTop: 8 }}>
                                {w.items.length ? (
                                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {w.items.map((it) => (
                                      <li key={it} style={{ marginBottom: 6 }}>{it}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span>Review + practice projects</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="small" style={{ marginTop: 10 }}>
                          Suggested next upgrade: add course links (SkillsFuture/Coursera/YouTube) and a mini-project for each week.
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
