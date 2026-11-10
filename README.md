# FCHS Course Description Guide (website)

A browse-only course catalog that matches the look of the FCHS Course Planner. Students can search, filter by grade and course features, and open any course to see its full description, prerequisites, credits, and dual-credit details. **There is no schedule building.**

Every course and detail on the site is read directly from the department Course Description Guides you put in the `guides` folder. The site does not add, guess, or change any course information.

---

## What's in this folder

| File / folder | What it is | Do you edit it? |
|---|---|---|
| `index.html`, `styles.css`, `app.js` | The website itself | No |
| `assets/logo.png` | FCHS logo | Only to change the logo |
| `data/guides.json` | School year + list of department guide files | Once a year (school year) |
| `guides/` | One `.md` file per department guide | Yes: this is where the course info lives |
| `.nojekyll` | Tells GitHub Pages to serve the guide files as-is | No |

---

## One-time setup on GitHub

1. Go to **github.com/new** and create a repository (for example `fc-course-guide`). Set it to **Public**, then click **Create repository**.
2. On the new repository's page, click **uploading an existing file**. Drag in **everything inside this folder** (all files and the `assets`, `data`, and `guides` folders), then click **Commit changes**.
   - `.nojekyll` is a hidden file and may not get picked up when you drag. If it's missing from the file list afterward, click **Add file → Create new file**, name it `.nojekyll`, leave it empty, and commit.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute or two, the address appears at the top of the Pages screen (for example `https://yourname.github.io/fc-course-guide/`).

---

## Adding the course guides (and updating them anytime)

The site reads each guide as a **Markdown (.md)** file downloaded from Google Docs.

1. Open a department guide in Google Docs.
2. Click **File → Download → Markdown (.md)**.
3. Rename the downloaded file to the name in the table below.
4. In GitHub, open the `guides` folder → **Add file → Upload files** → drag in the file → **Commit changes**. If a file with the same name is already there, it gets replaced.

| Google Doc | Rename the download to |
|---|---|
| Business \| 2027-2028 Course Description Guide | `business.md` |
| Engineering and Technology Education \| 2027-2028 Course Description Guide | `engineering-technology.md` |
| English Language Arts \| 2027-2028 Course Description Guide | `english.md` |
| Family and Consumer Sciences \| 2027-2028 Course Description Guide | `family-consumer-sciences.md` |
| Mathematics \| 2027-2028 Course Description Guide | `math.md` |
| Multidisciplinary \| 2027-2028 Course Description Guide | `multidisciplinary.md` |
| Multilingual Learners (ML) \| 2027-2028 Course Description Guide | `multilingual-learners.md` |
| Performing Arts \| 2027-2028 Course Description Guide | `performing-arts.md` |
| Physical Education \| 2027-2028 Course Description Guide | `physical-education.md` |
| Science \| 2027-2028 Course Description Guide | `science.md` |
| Social Studies \| 2027-2028 Course Description Guide | `social-studies.md` |
| Special Education \| 2027-2028 Course Description Guide | `special-education.md` |
| Visual Arts \| 2027-2028 Course Description Guide | `visual-arts.md` |
| World Languages \| 2027-2028 Course Description Guide | `world-languages.md` |

Changes appear on the live site within a few minutes. Do a hard refresh (Ctrl+Shift+R, or Cmd+Shift+R on a Mac) if you don't see them.

If a guide is missing or can't be read, the site shows a yellow **"Not shown yet"** notice that names the department, so nothing quietly disappears.

### How the guides need to be formatted

Keep the format your guides already use. Each course gets its own **two-column table** whose first row is **Course Title**. The site recognizes these row labels:

Course Title · Department · Course Description · Grade Level(s) · Length & Credits · Max Times Course May Be Taken · Pathway / Sequence · Prerequisite(s) · Co-requisite(s) · NCAA Approved · Application / Audition / Approval Required · Work-Based Learning Hours · AP Course / AP Exam Required · Required Texts / Novels / Major Works · Industry Certification / Credential Earned · Dual Credit Offered · Partnering University · College Course Code(s) & Title(s) · Dual Credit Eligibility (GPA/test scores) · FC / State Course Code · Other Notes / Footnotes · School Year This Applies To

- If you add a new row label, it still shows up on the course under **Additional Information**.
- The multi-column **Department Course Overview Table** is skipped, so the full course tables are the only source of truth.
- Notes at the top of a guide, above the first table (such as the *"Unless a specific level is named…"* prerequisite note), appear at the top of that department's list.
- Filters depend on the wording in the guides. **AP** counts a course when its AP field starts with "Yes" or says "AP course: Yes." **Dual Credit**, **NCAA Approved**, and **Application Required** count a course when the value starts with "Yes." **Work-Based Learning Hours** counts a course when the hours are filled in with something other than N/A or 0. A label with an extra word, like "Expected Work-Based Learning Hours," is still recognized.
- **Pathways** come from the "Pathway / Sequence" row, written as `Pathway name — sequence` with a long dash (—) between them, for example `Software Development — follows Principles of Computing`. The numbered pathway list in each course's details is built from that wording:
  - "first course" puts a course at step 1.
  - "follows *Course Title*" puts it one step after that course.
  - "also part of the *Name* pathway" or "also an option in the *Name* pathway" adds the course to another pathway. To give it a different position in that pathway, add the courses it follows in parentheses, for example `also part of the Business Administration pathway (follows Management Fundamentals or Marketing Fundamentals)`.
- A "Things to check with the department" list placed above the first table is treated as an internal note and is not shown on the site.
  - Write pathway names the same way in every course (for example, always "Marketing & Sales"). Courses whose position can't be worked out are listed under "Also in this pathway" without a number.

---

## Each new school year

1. Download the new guides and replace the files in `guides/` (same file names).
2. Open `data/guides.json`, click the pencil icon, change `"schoolYear": "2027–2028"` to the new year, and commit.

To add or remove a department, add or remove its line in `data/guides.json`, using the same pattern as the other lines.

---

## Previewing on your own computer

Double-clicking `index.html` will show "could not be loaded," because browsers block a page opened straight from your computer from reading other files. The site works once it's on GitHub Pages.
