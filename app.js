/*
 * FCHS Course Description Guide
 * ------------------------------------------------------------------
 * The site reads the department Course Description Guides directly from
 * the Markdown (.md) files in the /guides folder. Which files are loaded
 * (and in what order) is set in data/guides.json.
 *
 * To update for a new school year you only replace the .md files (and the
 * schoolYear in data/guides.json). No code changes are needed.
 *
 * Nothing is invented here: every course and every detail shown on the
 * page comes from a "Course Title" table in one of the guide files.
 */
(function () {
  'use strict';

  // Field labels as they appear in the guides -> internal keys.
  // Matching ignores capitalization, spacing and punctuation.
  var FIELD_DEFS = [
    ['title', 'Course Title'],
    ['department', 'Department'],
    ['description', 'Course Description'],
    ['grades', 'Grade Level(s)'],
    ['length', 'Length & Credits'],
    ['maxTimes', 'Max Times Course May Be Taken'],
    ['pathway', 'Pathway / Sequence'],
    ['prereq', 'Prerequisite(s)'],
    ['coreq', 'Co-requisite(s)'],
    ['ncaa', 'NCAA Approved'],
    ['application', 'Application / Audition / Approval Required'],
    ['wbl', 'Work-Based Learning Hours'],
    ['ap', 'AP Course / AP Exam Required'],
    ['texts', 'Required Texts / Novels / Major Works'],
    ['credential', 'Industry Certification / Credential Earned'],
    ['dual', 'Dual Credit Offered'],
    ['university', 'Partnering University'],
    ['collegeCodes', 'College Course Code(s) & Title(s)'],
    ['dualElig', 'Dual Credit Eligibility (GPA/test scores)'],
    ['code', 'FC / State Course Code'],
    ['notes', 'Other Notes / Footnotes'],
    ['year', 'School Year This Applies To']
  ];
  var LABELS = {};
  var KEY_BY_NORM = {};
  FIELD_DEFS.forEach(function (d) {
    LABELS[d[0]] = d[1];
    KEY_BY_NORM[normKey(d[1])] = d[0];
  });

  var FLAG_FILTERS = [
    { id: 'ap', label: 'AP', test: function (c) { return isYes(c.f.ap); } },
    { id: 'dual', label: 'Dual Credit', test: function (c) { return isYes(c.f.dual); } },
    { id: 'ncaa', label: 'NCAA Approved', test: function (c) { return isYes(c.f.ncaa); } },
    { id: 'credential', label: 'Industry Credential', test: function (c) { return hasValue(c.f.credential); } },
    { id: 'wbl', label: 'Work-Based Learning Hours', test: function (c) { return hasValue(c.f.wbl); } },
    { id: 'noprereq', label: 'No Prerequisite', test: function (c) { return !hasValue(c.f.prereq); } },
    { id: 'application', label: 'Application / Audition Required', test: function (c) { return isYes(c.f.application); } }
  ];
  var GRADES = [9, 10, 11, 12];

  var state = {
    config: null,
    departments: [],   // {name, slug, file, notes:[], courses:[], loaded:bool}
    courses: [],
    byId: {},
    titleIndex: [],    // [{title, id}] longest first, for prerequisite links
    dept: 'all',
    search: '',
    grade: null,
    flags: {}
  };

  // ---------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------
  function normKey(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  // Undo Markdown escaping produced by Google Docs' "Download as Markdown".
  function cleanCell(s) {
    var out = String(s)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ');
    // Repeat so that double-escaped characters (\\\!) are fully unescaped.
    for (var i = 0; i < 3; i++) out = out.replace(/\\([^\w\s])/g, '$1');
    out = out.replace(/\*\*/g, '');
    return out.trim();
  }
  function cleanKey(s) {
    return cleanCell(s).replace(/[*_]/g, '').replace(/:\s*$/, '').trim();
  }
  var EMPTY_RE = /^(n\/?a|none|-+|—|–)\.?$/i;
  function hasValue(v) {
    return !!v && !EMPTY_RE.test(String(v).trim());
  }
  function isYes(v) {
    return !!v && /^\s*yes\b/i.test(v);
  }

  // Grade levels: "9–12", "10-12", "11, 12", "12" -> [9..12]. Returns null if unreadable.
  function parseGrades(text) {
    if (!text) return null;
    var found = {};
    var t = String(text).replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    var rangeRe = /(\d{1,2})\s*(?:–|—|-|to|through)\s*(\d{1,2})/gi;
    var m;
    var rest = t;
    while ((m = rangeRe.exec(t)) !== null) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a <= b && b - a <= 12) for (var g = a; g <= b; g++) found[g] = true;
    }
    rest = t.replace(rangeRe, ' ');
    (rest.match(/\b\d{1,2}\b/g) || []).forEach(function (n) { found[parseInt(n, 10)] = true; });
    var list = GRADES.filter(function (g) { return found[g]; });
    return list.length ? list : null;
  }

  // ---------------------------------------------------------------
  // Guide (Markdown) parser
  // ---------------------------------------------------------------
  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|' && s.charAt(s.length - 2) !== '\\') s = s.slice(0, -1);
    var cells = [], cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '\\' && i + 1 < s.length) { cur += ch + s.charAt(i + 1); i++; continue; }
      if (ch === '|') { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return cells.map(function (c) { return c.trim(); });
  }
  function isSeparatorRow(cells) {
    return cells.every(function (c) { return /^:?-+:?$/.test(c.trim()) || c.trim() === ''; }) &&
      cells.some(function (c) { return /-/.test(c); });
  }

  function parseGuide(text) {
    var lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    var tables = [];
    var preamble = [];
    var seenTable = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*\|/.test(line)) {
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          var cells = splitRow(lines[i]);
          if (!isSeparatorRow(cells)) rows.push(cells);
          i++;
        }
        tables.push(rows);
        seenTable = true;
        continue;
      }
      if (!seenTable) preamble.push(line);
      i++;
    }

    var courses = [];
    tables.forEach(function (rows) {
      var fields = {};
      var extras = [];
      var isCourse = false;
      rows.forEach(function (cells) {
        if (cells.length < 2) return;
        var label = cleanKey(cells[0]);
        if (!label) return;
        var value = cleanCell(cells.slice(1).join(' | '));
        var key = KEY_BY_NORM[normKey(label)];
        if (key) {
          fields[key] = value;
          if (key === 'title' && value) isCourse = true;
        } else {
          extras.push({ label: label, value: value });
        }
      });
      // Only two-column "Course Title" tables are course entries; the
      // multi-column overview table is skipped.
      var twoCol = rows.every(function (r) { return r.length <= 2; });
      if (isCourse && twoCol) courses.push({ f: fields, extras: extras });
    });

    // Department-wide notes (e.g. the prerequisite-level footnote) that sit
    // above the first table. Headings and the "Department: ... School Year:" line are skipped.
    var notes = preamble
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l && !/^#/.test(l); })
      .map(cleanCell)
      .filter(function (l) { return l && !/^department\s*:/i.test(l.replace(/[*_]/g, '')); });

    return { courses: courses, notes: notes };
  }

  // ---------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------
  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.text();
    });
  }

  function load() {
    fetchText('data/guides.json')
      .then(function (txt) {
        state.config = JSON.parse(txt);
        var cfg = state.config;
        if (cfg.schoolYear) {
          document.getElementById('yearLabel').textContent = ' for the ' + cfg.schoolYear + ' school year';
          document.getElementById('footerYear').textContent = cfg.schoolYear;
          document.title = 'FCHS Course Description Guide ' + cfg.schoolYear;
        }
        return Promise.all(cfg.guides.map(function (g) {
          var dept = { name: g.department, slug: slugify(g.department), file: g.file, notes: [], courses: [], loaded: false, error: null };
          state.departments.push(dept);
          return fetchText('guides/' + encodeURIComponent(g.file).replace(/%2F/g, '/'))
            .then(function (md) {
              var parsed = parseGuide(md);
              dept.notes = parsed.notes;
              dept.courses = parsed.courses;
              dept.loaded = true;
              if (!parsed.courses.length) dept.error = 'no course tables were found in the file';
            })
            .catch(function (err) { dept.error = 'file not found (' + err.message + ')'; });
        }));
      })
      .then(finishLoad)
      .catch(function (err) {
        document.getElementById('catalog').innerHTML =
          '<p class="empty-state">The course guide could not be loaded (' + escapeHtml(err.message) + '). ' +
          'If you opened index.html straight from your computer, the page has to be viewed through a web server such as GitHub Pages.</p>';
      });
  }

  function finishLoad() {
    var used = {};
    state.departments.forEach(function (dept) {
      dept.courses.forEach(function (c) {
        c.dept = dept;
        var base = slugify(c.f.title) || 'course';
        var id = base, n = 2;
        while (used[id]) id = base + '-' + (n++);
        used[id] = true;
        c.id = id;
        c.grades = parseGrades(c.f.grades);
        c.searchText = [c.f.title, c.f.code, c.f.description, c.f.pathway, c.f.prereq, c.f.collegeCodes, dept.name]
          .filter(Boolean).join(' ').toLowerCase();
        state.courses.push(c);
        state.byId[id] = c;
      });
    });
    state.titleIndex = state.courses
      .map(function (c) { return { title: c.f.title, id: c.id }; })
      .sort(function (a, b) { return b.title.length - a.title.length; });

    // "Listed as a prerequisite for" — built only from exact course titles found in prerequisite text.
    state.courses.forEach(function (c) { c.requiredBy = []; });
    state.courses.forEach(function (c) {
      findCourseMentions(c.f.prereq || '').forEach(function (id) {
        var target = state.byId[id];
        if (target && target !== c && target.requiredBy.indexOf(c) === -1) target.requiredBy.push(c);
      });
    });

    showLoadWarnings();
    buildFilterBar();
    readHash();
    renderRail();
    renderCatalog();
    window.addEventListener('hashchange', function () { readHash(true); });
  }

  function showLoadWarnings() {
    var bad = state.departments.filter(function (d) { return d.error; });
    var box = document.getElementById('loadWarning');
    if (!bad.length) { box.style.display = 'none'; return; }
    box.innerHTML = '<strong>Not shown yet:</strong> ' +
      bad.map(function (d) {
        return '<span title="guides/' + escapeHtml(d.file) + ': ' + escapeHtml(d.error) + '">' + escapeHtml(d.name) + '</span>';
      }).join(', ') +
      '. These department guides are missing from the guides folder or could not be read.';
    box.style.display = '';
  }

  // ---------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------
  function activeFlagFilters() {
    return FLAG_FILTERS.filter(function (f) { return state.flags[f.id]; });
  }
  function matches(c, ignoreDept) {
    if (!ignoreDept && state.dept !== 'all' && c.dept.slug !== state.dept) return false;
    if (state.grade && c.grades && c.grades.indexOf(state.grade) === -1) return false;
    var flags = activeFlagFilters();
    for (var i = 0; i < flags.length; i++) if (!flags[i].test(c)) return false;
    if (state.search) {
      var words = state.search.toLowerCase().split(/\s+/).filter(Boolean);
      for (var w = 0; w < words.length; w++) if (c.searchText.indexOf(words[w]) === -1) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Rendering: department rail
  // ---------------------------------------------------------------
  function renderRail() {
    var wrap = document.getElementById('deptRailButtons');
    var html = railButton('all', 'All Departments', state.courses.filter(function (c) { return matches(c, true); }).length, false);
    state.departments.forEach(function (d) {
      var count = d.courses.filter(function (c) { return matches(c, true); }).length;
      html += railButton(d.slug, d.name, d.error && !d.courses.length ? '—' : count, !!(d.error && !d.courses.length));
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.dept-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.dept = btn.getAttribute('data-dept');
        writeHash();
        renderRail();
        renderCatalog();
        var top = document.querySelector('.layout').getBoundingClientRect().top;
        if (top < 0) window.scrollBy({ top: top, behavior: 'smooth' });
      });
    });
    var active = wrap.querySelector('.dept-item.active');
    // On phones the rail scrolls sideways; keep the active department in view without moving the page.
    if (active && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollLeft = active.offsetLeft - wrap.offsetLeft - (wrap.clientWidth - active.offsetWidth) / 2;
    }
  }
  function railButton(slug, name, count, missing) {
    return '<button class="dept-item' + (state.dept === slug ? ' active' : '') + (missing ? ' missing' : '') +
      '" data-dept="' + escapeHtml(slug) + '"' + (state.dept === slug ? ' aria-current="true"' : '') + '>' +
      '<span>' + escapeHtml(name) + '</span><span class="dept-count">' + count + '</span></button>';
  }

  // ---------------------------------------------------------------
  // Rendering: filter bar
  // ---------------------------------------------------------------
  function buildFilterBar() {
    var bar = document.getElementById('filterBar');
    var html = '<div class="filter-group" role="group" aria-label="Grade level"><span class="filter-group-label">Grade</span>';
    GRADES.forEach(function (g) {
      html += '<button class="filter-chip" data-grade="' + g + '">' + g + 'th</button>';
    });
    html += '</div><div class="filter-group" role="group" aria-label="Course features">';
    FLAG_FILTERS.forEach(function (f) {
      html += '<button class="filter-chip" data-flag="' + f.id + '">' + escapeHtml(f.label) + '</button>';
    });
    html += '</div><button class="filter-clear" id="filterClear">Clear filters</button>';
    bar.innerHTML = html;

    bar.querySelectorAll('[data-grade]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = parseInt(btn.getAttribute('data-grade'), 10);
        state.grade = state.grade === g ? null : g;
        refresh();
      });
    });
    bar.querySelectorAll('[data-flag]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-flag');
        state.flags[id] = !state.flags[id];
        refresh();
      });
    });
    document.getElementById('filterClear').addEventListener('click', function () {
      state.grade = null; state.flags = {}; state.search = '';
      document.getElementById('searchInput').value = '';
      refresh();
    });
  }
  function syncFilterBar() {
    document.querySelectorAll('#filterBar [data-grade]').forEach(function (btn) {
      var on = state.grade === parseInt(btn.getAttribute('data-grade'), 10);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('#filterBar [data-flag]').forEach(function (btn) {
      var on = !!state.flags[btn.getAttribute('data-flag')];
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on);
    });
    var n = (state.grade ? 1 : 0) + activeFlagFilters().length;
    var toggle = document.getElementById('filtersToggleBtn');
    toggle.textContent = n ? 'Filters (' + n + ')' : 'Filters';
  }
  function refresh() {
    syncFilterBar();
    renderRail();
    renderCatalog();
  }

  // ---------------------------------------------------------------
  // Rendering: course list
  // ---------------------------------------------------------------
  function badgesFor(c) {
    var b = [];
    if (isYes(c.f.ap)) b.push('<span class="badge ap">AP</span>');
    if (isYes(c.f.dual)) b.push('<span class="badge dual">Dual Credit</span>');
    if (isYes(c.f.ncaa)) b.push('<span class="badge req">NCAA</span>');
    if (hasValue(c.f.credential)) b.push('<span class="badge seal">Credential</span>');
    if (hasValue(c.f.wbl)) b.push('<span class="badge pathway">Work-Based Learning</span>');
    if (isYes(c.f.application)) b.push('<span class="badge icc">Application</span>');
    return b.join('');
  }

  function courseRow(c) {
    var meta = [];
    if (hasValue(c.f.grades)) meta.push('Grades ' + escapeHtml(c.f.grades));
    if (hasValue(c.f.length)) meta.push(escapeHtml(c.f.length));
    if (hasValue(c.f.code)) meta.push('<span class="course-code">' + escapeHtml(c.f.code) + '</span>');
    var prereq = hasValue(c.f.prereq)
      ? '<p class="course-prereq"><strong>Prerequisite:</strong> ' + escapeHtml(truncate(c.f.prereq, 140)) + '</p>' : '';
    return '<button class="course-row" data-id="' + escapeHtml(c.id) + '">' +
      '<div><p class="course-title">' + escapeHtml(c.f.title) + '</p>' +
      '<div class="course-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
      prereq + '</div>' +
      '<div class="badges">' + badgesFor(c) + '</div></button>';
  }
  function truncate(s, n) {
    s = String(s).replace(/\s+/g, ' ');
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  function renderCatalog() {
    var main = document.getElementById('catalog');
    var depts = state.dept === 'all'
      ? state.departments
      : state.departments.filter(function (d) { return d.slug === state.dept; });
    var total = 0;
    var html = '';
    depts.forEach(function (d) {
      var list = d.courses.filter(function (c) { return matches(c); });
      total += list.length;
      var showEmptyDept = state.dept !== 'all';
      if (!list.length && !showEmptyDept) return;
      html += '<section class="dept-section"><h2 class="dept-heading">' + escapeHtml(d.name) + '</h2>';
      if (d.notes.length && list.length) {
        html += '<div class="dept-note">' + d.notes.map(function (n) { return '<p>' + escapeHtml(n) + '</p>'; }).join('') + '</div>';
      }
      if (d.error && !d.courses.length) {
        html += '<p class="empty-state">This department’s guide has not been added yet (guides/' + escapeHtml(d.file) + ').</p>';
      } else if (!list.length) {
        html += '<p class="empty-state">No ' + escapeHtml(d.name) + ' courses match your search and filters.</p>';
      } else {
        html += list.map(courseRow).join('');
      }
      html += '</section>';
    });
    if (!total && state.dept === 'all') {
      html = '<p class="empty-state">No courses match your search and filters. Try removing a filter or searching for a different word.</p>';
    }
    main.innerHTML = html;
    main.querySelectorAll('.course-row').forEach(function (row) {
      row.addEventListener('click', function () { openCourse(row.getAttribute('data-id')); });
    });
    document.getElementById('resultCount').textContent = total + (total === 1 ? ' course' : ' courses');
  }

  // ---------------------------------------------------------------
  // Rich text: Markdown links, bare URLs, and links to other courses
  // ---------------------------------------------------------------
  function findCourseMentions(text) {
    var ids = [];
    tokenizeCourses(text).forEach(function (t) { if (t.id && ids.indexOf(t.id) === -1) ids.push(t.id); });
    return ids;
  }
  function isBoundary(ch) { return !ch || !/[A-Za-z0-9]/.test(ch); }
  // Split text into plain pieces and exact course-title matches (longest title first).
  function tokenizeCourses(text) {
    var tokens = [];
    var lower = text.toLowerCase();
    var i = 0, plainStart = 0;
    while (i < text.length) {
      var hit = null;
      if (isBoundary(text.charAt(i - 1))) {
        for (var k = 0; k < state.titleIndex.length; k++) {
          var t = state.titleIndex[k].title;
          if (t.length < 4) continue;
          if (lower.substr(i, t.length) === t.toLowerCase()) {
            var next = text.charAt(i + t.length);
            var after = text.charAt(i + t.length + 1);
            // Avoid matching "Spanish I" inside "Spanish I-II" or "Spanish II".
            if (isBoundary(next) && !(/[-–]/.test(next) && /[A-Za-z0-9]/.test(after))) { hit = state.titleIndex[k]; break; }
          }
        }
      }
      if (hit) {
        if (i > plainStart) tokens.push({ text: text.slice(plainStart, i) });
        tokens.push({ text: text.substr(i, hit.title.length), id: hit.id });
        i += hit.title.length;
        plainStart = i;
      } else {
        i++;
      }
    }
    if (plainStart < text.length) tokens.push({ text: text.slice(plainStart) });
    return tokens;
  }
  function renderRich(text, opts) {
    opts = opts || {};
    var out = '';
    var linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>()]+)/g;
    var last = 0, m;
    while ((m = linkRe.exec(text)) !== null) {
      out += plain(text.slice(last, m.index), opts);
      var url = m[2] || m[3];
      var label = m[1] || m[3];
      out += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(label) + '</a>';
      last = m.index + m[0].length;
    }
    out += plain(text.slice(last), opts);
    return out.replace(/\n/g, '<br>');
  }
  function plain(text, opts) {
    if (!opts.linkCourses) return escapeHtml(text);
    return tokenizeCourses(text).map(function (t) {
      if (t.id && t.id !== opts.selfId) {
        return '<button class="course-link" data-goto="' + escapeHtml(t.id) + '">' + escapeHtml(t.text) + '</button>';
      }
      return escapeHtml(t.text);
    }).join('');
  }

  // ---------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------
  function row(key, c, opts) {
    var v = c.f[key];
    if (v === undefined || v === '') return '';
    if (opts && opts.hideEmpty && !hasValue(v)) return '';
    return '<p><strong>' + escapeHtml(LABELS[key]) + ':</strong> ' + renderRich(v, opts && opts.rich) + '</p>';
  }
  function block(title, inner) {
    if (!inner) return '';
    return '<h3>' + escapeHtml(title) + '</h3><div class="dc-block">' + inner + '</div>';
  }

  function openCourse(id, fromHash) {
    var c = state.byId[id];
    if (!c) return;
    var link = { linkCourses: true, selfId: c.id };
    var html = '<h2 id="detailTitle">' + escapeHtml(c.f.title) + '</h2>';
    if (hasValue(c.f.code)) html += '<div class="detail-code">' + escapeHtml(c.f.code) + '</div>';
    html += '<p class="detail-dept">' + escapeHtml(c.dept.name) + (hasValue(c.f.year) ? ' · ' + escapeHtml(c.f.year) : '') + '</p>';
    var badges = badgesFor(c);
    if (badges) html += '<div class="badges">' + badges + '</div>';

    if (hasValue(c.f.description)) html += '<h3>Course Description</h3><p>' + renderRich(c.f.description) + '</p>';

    html += block('At a Glance',
      row('grades', c) + row('length', c) + row('maxTimes', c) + row('pathway', c, { hideEmpty: true, rich: link }));

    var prereqInner = row('prereq', c, { rich: link }) + row('coreq', c, { hideEmpty: true, rich: link }) + row('application', c, { rich: {} });
    if (c.dept.notes.length && hasValue(c.f.prereq)) {
      prereqInner += c.dept.notes.map(function (n) { return '<p><em>' + escapeHtml(n) + '</em></p>'; }).join('');
    }
    html += block('Prerequisites & Requirements', prereqInner);

    if (c.requiredBy.length) {
      html += '<h3>Listed as a Prerequisite For</h3><div class="dc-block"><ul>' +
        c.requiredBy.map(function (r) {
          return '<li><button class="course-link" data-goto="' + escapeHtml(r.id) + '">' + escapeHtml(r.f.title) + '</button></li>';
        }).join('') + '</ul></div>';
    }

    if (isYes(c.f.dual)) {
      html += block('Dual Credit',
        row('dual', c) + row('university', c, { hideEmpty: true }) + row('collegeCodes', c, { hideEmpty: true }) + row('dualElig', c, { hideEmpty: true }));
    }

    var more = '';
    if (!isYes(c.f.dual)) more += row('dual', c);
    more += row('ap', c) + row('ncaa', c) +
      row('credential', c, { hideEmpty: true }) + row('wbl', c, { hideEmpty: true }) +
      row('texts', c, { hideEmpty: true }) + row('notes', c, { hideEmpty: true, rich: link });
    c.extras.forEach(function (x) {
      if (hasValue(x.value)) more += '<p><strong>' + escapeHtml(x.label) + ':</strong> ' + renderRich(x.value) + '</p>';
    });
    html += block('Additional Information', more);

    html += '<p class="detail-source">From the ' + escapeHtml(c.dept.name) + ' ' +
      escapeHtml((state.config && state.config.schoolYear) || '') +
      ' Course Description Guide. Course offerings can change; confirm details with your school counselor.</p>';

    var content = document.getElementById('detailContent');
    content.innerHTML = html;
    content.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () { openCourse(btn.getAttribute('data-goto')); });
    });
    var panel = document.getElementById('detailPanel');
    panel.scrollTop = 0;
    if (!panel.classList.contains('open')) state.returnFocus = document.activeElement;
    panel.classList.add('open');
    document.getElementById('scrim').classList.add('open');
    state.openId = id;
    if (!fromHash) writeHash();
    document.getElementById('detailClose').focus();
  }
  function closeCourse() {
    document.getElementById('detailPanel').classList.remove('open');
    document.getElementById('scrim').classList.remove('open');
    state.openId = null;
    writeHash();
    if (state.returnFocus && document.body.contains(state.returnFocus)) state.returnFocus.focus();
  }

  // ---------------------------------------------------------------
  // URL hash: #dept=science&course=biology-i
  // ---------------------------------------------------------------
  function writeHash() {
    var parts = [];
    if (state.dept !== 'all') parts.push('dept=' + encodeURIComponent(state.dept));
    if (state.openId) parts.push('course=' + encodeURIComponent(state.openId));
    var h = parts.length ? '#' + parts.join('&') : ' ';
    if (('#' + parts.join('&')) !== location.hash) history.replaceState(null, '', h === ' ' ? location.pathname + location.search : h);
  }
  function readHash(rerender) {
    var params = {};
    location.hash.replace(/^#/, '').split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
    });
    var deptOk = params.dept && state.departments.some(function (d) { return d.slug === params.dept; });
    state.dept = deptOk ? params.dept : 'all';
    if (rerender) { renderRail(); renderCatalog(); }
    if (params.course && state.byId[params.course]) openCourse(params.course, true);
  }

  // ---------------------------------------------------------------
  // Static UI wiring
  // ---------------------------------------------------------------
  function wire() {
    var search = document.getElementById('searchInput');
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        state.search = search.value.trim();
        renderRail();
        renderCatalog();
      }, 120);
    });
    var toggle = document.getElementById('filtersToggleBtn');
    toggle.addEventListener('click', function () {
      var bar = document.getElementById('filterBar');
      var show = bar.style.display === 'none';
      bar.style.display = show ? '' : 'none';
      toggle.classList.toggle('active', show);
      toggle.setAttribute('aria-expanded', show);
    });
    document.getElementById('detailClose').addEventListener('click', closeCourse);
    document.getElementById('scrim').addEventListener('click', closeCourse);
    var help = document.getElementById('helpOverlay');
    document.getElementById('helpBtn').addEventListener('click', function () {
      help.style.display = '';
      document.getElementById('helpCloseBtn').focus();
    });
    document.getElementById('helpCloseBtn').addEventListener('click', function () {
      help.style.display = 'none';
      document.getElementById('helpBtn').focus();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (help.style.display !== 'none') { help.style.display = 'none'; return; }
      if (document.getElementById('detailPanel').classList.contains('open')) closeCourse();
    });
  }

  // Exposed for testing only.
  window.__courseGuide = { parseGuide: parseGuide, parseGrades: parseGrades, state: state };

  wire();
  load();
})();
