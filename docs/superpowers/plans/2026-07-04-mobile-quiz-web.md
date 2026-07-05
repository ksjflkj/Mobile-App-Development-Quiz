# Mobile Quiz Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local static quiz web app for all 140 mobile application development questions.

**Architecture:** Store verified question data in `data/questions.json`, keep answer checking and scoring as pure JavaScript in `src/quiz-core.mjs`, and keep DOM rendering/state in `app.js`. The app runs from a local static server, uses `localStorage` only for wrong-question IDs, and needs no backend.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript ES modules, Node.js scripts for validation/tests.

---

## File Structure

- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/.gitignore`
  - Ignores `.superpowers/` visual brainstorming artifacts and local transient files.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/index.html`
  - Static app shell and semantic regions for navigation, quiz content, and side panel.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/styles.css`
  - Hybrid three-column desktop layout and responsive single-column mobile layout.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/app.js`
  - Browser-only app state, rendering, event handling, `localStorage`, and data loading.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/src/quiz-core.mjs`
  - Pure quiz functions: answer normalization, correctness, scoring, shuffling, session creation.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/data/questions.json`
  - Final verified 140-question dataset.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/tools/core-tests.mjs`
  - Node test script for pure quiz logic.
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/tools/validate-questions.mjs`
  - Node validator for the question JSON schema and content invariants.

Git commands in this repository should run from `C:/Users/Mrliao`, because the Git root is the user directory and this project is a subdirectory.

---

### Task 1: Project Scaffold And Git Hygiene

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/.gitignore`
- Create directories: `data/`, `src/`, `tools/`

- [ ] **Step 1: Create the project directories**

Run from `C:/Users/Mrliao/Desktop/移动应用开发题库`:

```powershell
New-Item -ItemType Directory -Force -Path 'data','src','tools' | Out-Null
```

Expected: command exits successfully and the three directories exist.

- [ ] **Step 2: Create project `.gitignore`**

Write this exact content to `C:/Users/Mrliao/Desktop/移动应用开发题库/.gitignore`:

```gitignore
.superpowers/
*.tmp
*.log
```

- [ ] **Step 3: Verify only intended files are visible**

Run from `C:/Users/Mrliao`:

```powershell
git status --short -- 'Desktop/移动应用开发题库'
```

Expected: `.superpowers/` is not shown after `.gitignore` is created. New project files may be shown as untracked.

- [ ] **Step 4: Commit scaffold**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/.gitignore'
git commit -m "chore: add quiz project gitignore"
```

Expected: commit succeeds and includes only `.gitignore`.

---

### Task 2: Core Quiz Logic With Tests

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/tools/core-tests.mjs`
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/src/quiz-core.mjs`

- [ ] **Step 1: Write the failing core tests**

Create `tools/core-tests.mjs`:

```js
import assert from "node:assert/strict";
import {
  normalizeAnswer,
  isAnswerCorrect,
  scoreExam,
  createSessionQuestions,
} from "../src/quiz-core.mjs";

const sampleQuestions = [
  { id: "q1", set: "测验1", number: 1, answer: ["C"] },
  { id: "q2", set: "测验1", number: 2, answer: ["A", "C"] },
  { id: "q3", set: "测验2", number: 1, answer: ["B"] },
];

assert.deepEqual(normalizeAnswer(["c"]), ["C"]);
assert.deepEqual(normalizeAnswer(["C", "A", "A"]), ["A", "C"]);
assert.equal(isAnswerCorrect(["c"], ["C"]), true);
assert.equal(isAnswerCorrect(["A", "C"], ["C", "A"]), true);
assert.equal(isAnswerCorrect(["A"], ["A", "C"]), false);

assert.deepEqual(
  scoreExam(sampleQuestions, { q1: ["C"], q2: ["C", "A"], q3: ["A"] }),
  {
    total: 3,
    correct: 2,
    wrong: 1,
    percent: 67,
    wrongIds: ["q3"],
  },
);

const ordered = createSessionQuestions(sampleQuestions, {
  scope: "set",
  setName: "测验1",
  random: false,
});
assert.deepEqual(ordered.map((q) => q.id), ["q1", "q2"]);

const random = createSessionQuestions(sampleQuestions, {
  scope: "all",
  random: true,
  seed: 42,
});
assert.equal(random.length, 3);
assert.notDeepEqual(random.map((q) => q.id), sampleQuestions.map((q) => q.id));

console.log("core tests passed");
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `C:/Users/Mrliao/Desktop/移动应用开发题库`:

```powershell
node tools/core-tests.mjs
```

Expected: FAIL with an import error because `src/quiz-core.mjs` does not exist.

- [ ] **Step 3: Implement the core module**

Create `src/quiz-core.mjs`:

```js
export function normalizeAnswer(answer) {
  return [...new Set(answer.map((item) => String(item).trim().toUpperCase()).filter(Boolean))].sort();
}

export function isAnswerCorrect(selected, correct) {
  const left = normalizeAnswer(selected);
  const right = normalizeAnswer(correct);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function scoreExam(questions, answersById) {
  const wrongIds = [];
  let correct = 0;

  for (const question of questions) {
    const selected = answersById[question.id] || [];
    if (isAnswerCorrect(selected, question.answer)) {
      correct += 1;
    } else {
      wrongIds.push(question.id);
    }
  }

  const total = questions.length;
  const wrong = total - correct;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, wrong, percent, wrongIds };
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function shuffleQuestions(questions, seed = Date.now()) {
  const random = seededRandom(seed);
  const result = [...questions];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSessionQuestions(questions, options) {
  const { scope, setName, random = false, seed = Date.now(), wrongIds = [] } = options;
  let result = [...questions];

  if (scope === "set") {
    result = result.filter((question) => question.set === setName);
  }

  if (scope === "wrong") {
    const wrongSet = new Set(wrongIds);
    result = result.filter((question) => wrongSet.has(question.id));
  }

  result.sort((a, b) => {
    const setCompare = String(a.set).localeCompare(String(b.set), "zh-Hans-CN");
    if (setCompare !== 0) return setCompare;
    return a.number - b.number;
  });

  return random ? shuffleQuestions(result, seed) : result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node tools/core-tests.mjs
```

Expected: `core tests passed`

- [ ] **Step 5: Commit core logic**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/src/quiz-core.mjs' 'Desktop/移动应用开发题库/tools/core-tests.mjs'
git commit -m "feat: add quiz core logic"
```

Expected: commit succeeds with the core module and tests.

---

### Task 3: Question Data Validator

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/tools/validate-questions.mjs`
- Create initially minimal: `C:/Users/Mrliao/Desktop/移动应用开发题库/data/questions.json`

- [ ] **Step 1: Write validator before final data exists**

Create `tools/validate-questions.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(projectRoot, "data", "questions.json");
const expectedSets = new Map([
  ["测验1", 40],
  ["测验2", 20],
  ["测验3", 20],
  ["测试4", 20],
  ["测试5", 20],
  ["测试6", 20],
]);
const validTypes = new Set(["single", "multiple", "judge"]);
const validOptionKeys = new Set(["A", "B", "C", "D"]);

function fail(message) {
  console.error(`question validation failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(dataPath)) {
  fail(`missing ${dataPath}`);
}

const questions = JSON.parse(fs.readFileSync(dataPath, "utf8"));
if (!Array.isArray(questions)) fail("top-level JSON must be an array");
if (questions.length !== 140) fail(`expected 140 questions, got ${questions.length}`);

const ids = new Set();
const counts = new Map();

for (const question of questions) {
  for (const field of ["id", "set", "number", "type", "question", "options", "answer", "explanation"]) {
    if (!(field in question)) fail(`${question.id || "unknown"} missing field ${field}`);
  }

  if (ids.has(question.id)) fail(`duplicate id ${question.id}`);
  ids.add(question.id);

  if (!expectedSets.has(question.set)) fail(`${question.id} has unknown set ${question.set}`);
  if (!Number.isInteger(question.number) || question.number < 1) fail(`${question.id} has invalid number`);
  if (!validTypes.has(question.type)) fail(`${question.id} has invalid type ${question.type}`);
  if (typeof question.question !== "string" || question.question.trim().length < 4) fail(`${question.id} question text is too short`);
  if (typeof question.explanation !== "string") fail(`${question.id} explanation must be a string`);

  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
    fail(`${question.id} options length must be 2-4`);
  }

  const optionKeys = new Set(question.options.map((option) => option.key));
  for (const option of question.options) {
    if (!validOptionKeys.has(option.key)) fail(`${question.id} invalid option key ${option.key}`);
    if (typeof option.text !== "string" || option.text.trim() === "") fail(`${question.id} has empty option ${option.key}`);
  }

  if (question.type === "judge") {
    const texts = question.options.map((option) => option.text).join("|");
    if (question.options.length !== 2 || texts !== "对|错") fail(`${question.id} judge options must be A. 对 and B. 错`);
  }

  if (!Array.isArray(question.answer) || question.answer.length === 0) fail(`${question.id} answer must be a non-empty array`);
  for (const key of question.answer) {
    if (!optionKeys.has(key)) fail(`${question.id} answer ${key} is not present in options`);
  }

  if (question.type === "single" && question.answer.length !== 1) fail(`${question.id} single answer must have one key`);
  if (question.type === "multiple" && question.answer.length < 2) fail(`${question.id} multiple answer must have at least two keys`);
  if (question.type === "judge" && question.answer.length !== 1) fail(`${question.id} judge answer must have one key`);

  counts.set(question.set, (counts.get(question.set) || 0) + 1);
}

for (const [setName, expectedCount] of expectedSets) {
  const actualCount = counts.get(setName) || 0;
  if (actualCount !== expectedCount) fail(`${setName} expected ${expectedCount}, got ${actualCount}`);

  const numbers = questions
    .filter((question) => question.set === setName)
    .map((question) => question.number)
    .sort((a, b) => a - b);
  for (let index = 0; index < expectedCount; index += 1) {
    if (numbers[index] !== index + 1) fail(`${setName} missing question number ${index + 1}`);
  }
}

console.log("question validation passed");
```

- [ ] **Step 2: Run validator to verify it fails**

Run:

```powershell
node tools/validate-questions.mjs
```

Expected: FAIL with `missing ... data/questions.json`.

- [ ] **Step 3: Create temporary invalid data to check count validation**

Create `data/questions.json`:

```json
[]
```

Run:

```powershell
node tools/validate-questions.mjs
```

Expected: FAIL with `expected 140 questions, got 0`.

- [ ] **Step 4: Commit validator**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/tools/validate-questions.mjs'
git commit -m "test: add question data validator"
```

Expected: commit includes only the validator. Do not commit the temporary empty `data/questions.json`.

---

### Task 4: Build The Verified 140-Question Dataset

**Files:**
- Create final: `C:/Users/Mrliao/Desktop/移动应用开发题库/data/questions.json`
- Read sources:
  - `C:/Users/Mrliao/Desktop/移动应用开发题库/测验1/[OCR]_测验1_20260704_1320.txt`
  - all `.png` files under `测验1`, `测验2`, `测验3`, `测试4`, `测试5`, `测试6`

- [ ] **Step 1: Use deterministic ID prefixes**

Use these exact ID prefixes and ranges:

```text
测验1 -> quiz1-001 through quiz1-040
测验2 -> quiz2-001 through quiz2-020
测验3 -> quiz3-001 through quiz3-020
测试4 -> test4-001 through test4-020
测试5 -> test5-001 through test5-020
测试6 -> test6-001 through test6-020
```

- [ ] **Step 2: Normalize judging questions**

For every 判断题, encode the options exactly as:

```json
[
  { "key": "A", "text": "对" },
  { "key": "B", "text": "错" }
]
```

If the screenshot correct answer is `对`, use `"answer": ["A"]`. If it is `错`, use `"answer": ["B"]`.

- [ ] **Step 3: Normalize answers**

For single-choice questions, store one key:

```json
"answer": ["C"]
```

For multiple-choice questions, store sorted keys:

```json
"answer": ["A", "C", "D"]
```

- [ ] **Step 4: Fix known OCR errors while entering data**

Apply these corrections when they appear in OCR text:

```text
pages.ison -> pages.json
is文件 -> js文件
is代码 -> js代码
引|入 -> 引入
Al讲解 -> AI讲解
相当王 -> 相当于
应田 -> 应用
衣键 -> 右键
```

Exclude screen chrome and app UI noise from question records:

```text
考试详情
答题卡
我的答案
本题得分
正确答案
上一题
下一题
AI讲解
手机状态栏文字
```

- [ ] **Step 5: Enter `测验1` from OCR plus screenshot checks**

Use the existing OCR file as the first pass. Manually inspect screenshots for:

```text
quiz1-001: confirm pages.json in option C and explanation
quiz1-005: confirm js文件 and js代码
quiz1-014: set answer to ["A"] because my answer is A and score is 2.5
quiz1-031 through quiz1-040: convert 对/错 answers to A/B
```

After entering `测验1`, run:

```powershell
node tools/validate-questions.mjs
```

Expected before all sets are entered: FAIL with set/count errors, not schema errors for `测验1` records.

- [ ] **Step 6: Enter remaining sets from screenshots**

For `测验2`, `测验3`, `测试4`, `测试5`, and `测试6`, enter each screenshot in filename order unless the visible question number indicates a different order. Use the visible `考试详情 n/20` and the question number line as the source of truth.

For each record, transcribe:

```text
set
number
type
question
options
answer
explanation
```

If a correct answer is partially hidden, infer it only when both conditions hold:

```text
我的答案 is visible
本题得分 is full credit
```

Otherwise inspect the screenshot area carefully before writing the record.

- [ ] **Step 7: Validate final dataset**

Run:

```powershell
node tools/validate-questions.mjs
```

Expected: `question validation passed`

- [ ] **Step 8: Commit dataset**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/data/questions.json'
git commit -m "data: add mobile quiz questions"
```

Expected: commit includes exactly `data/questions.json`.

---

### Task 5: Static HTML Shell

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/index.html`

- [ ] **Step 1: Create the HTML shell**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>移动应用开发题库</title>
    <link rel="stylesheet" href="./styles.css">
    <script type="module" src="./app.js"></script>
  </head>
  <body>
    <header class="app-header">
      <div>
        <h1>移动应用开发题库</h1>
        <p id="appSummary">加载题库中...</p>
      </div>
      <nav class="mode-switch" aria-label="刷题模式">
        <button id="practiceModeButton" class="is-active" type="button">练习</button>
        <button id="examModeButton" type="button">考试</button>
      </nav>
    </header>

    <div class="app-layout">
      <aside class="sidebar" aria-label="题库范围">
        <h2>题库</h2>
        <div id="scopeButtons" class="scope-list"></div>
        <button id="wrongScopeButton" class="scope-button wrong-scope" type="button">错题本</button>
      </aside>

      <main class="quiz-panel" aria-live="polite">
        <div class="question-meta" id="questionMeta"></div>
        <h2 id="questionText" class="question-text">正在加载...</h2>
        <div id="optionsList" class="options-list"></div>
        <section id="feedbackPanel" class="feedback-panel" hidden></section>
        <div class="quiz-actions">
          <button id="prevButton" type="button">上一题</button>
          <button id="removeWrongButton" type="button" hidden>移出错题</button>
          <button id="nextButton" type="button">下一题</button>
        </div>
      </main>

      <aside class="side-panel" aria-label="统计和答题卡">
        <section id="practiceStats"></section>
        <section id="examPanel" hidden>
          <h2>答题卡</h2>
          <div id="answerCard" class="answer-card"></div>
          <button id="submitExamButton" class="primary-button" type="button">交卷</button>
        </section>
      </aside>
    </div>

    <section id="resultDialog" class="result-dialog" hidden></section>
  </body>
</html>
```

- [ ] **Step 2: Check HTML syntax**

Run:

```powershell
node --check app.js
```

Expected before `app.js` exists: FAIL with missing file. This confirms HTML is ready for the JS task to supply the module.

- [ ] **Step 3: Commit HTML shell**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/index.html'
git commit -m "feat: add quiz app html shell"
```

Expected: commit includes only `index.html`.

---

### Task 6: Browser App State And Rendering

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/app.js`
- Modify only if needed: `C:/Users/Mrliao/Desktop/移动应用开发题库/index.html`

- [ ] **Step 1: Create `app.js` with data loading and state**

Create `app.js`:

```js
import { createSessionQuestions, isAnswerCorrect, normalizeAnswer, scoreExam } from "./src/quiz-core.mjs";

const wrongStorageKey = "mobile-quiz-wrong-ids";

const state = {
  questions: [],
  session: [],
  mode: "practice",
  scope: { type: "all", setName: null },
  currentIndex: 0,
  answersById: {},
  checkedById: {},
  wrongIds: new Set(),
};

const elements = {
  appSummary: document.querySelector("#appSummary"),
  practiceModeButton: document.querySelector("#practiceModeButton"),
  examModeButton: document.querySelector("#examModeButton"),
  scopeButtons: document.querySelector("#scopeButtons"),
  wrongScopeButton: document.querySelector("#wrongScopeButton"),
  questionMeta: document.querySelector("#questionMeta"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  removeWrongButton: document.querySelector("#removeWrongButton"),
  practiceStats: document.querySelector("#practiceStats"),
  examPanel: document.querySelector("#examPanel"),
  answerCard: document.querySelector("#answerCard"),
  submitExamButton: document.querySelector("#submitExamButton"),
  resultDialog: document.querySelector("#resultDialog"),
};

function loadWrongIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(wrongStorageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function saveWrongIds() {
  localStorage.setItem(wrongStorageKey, JSON.stringify([...state.wrongIds]));
}

function getCurrentQuestion() {
  return state.session[state.currentIndex] || null;
}

function setMode(mode) {
  state.mode = mode;
  state.answersById = {};
  state.checkedById = {};
  state.currentIndex = 0;
  elements.practiceModeButton.classList.toggle("is-active", mode === "practice");
  elements.examModeButton.classList.toggle("is-active", mode === "exam");
  elements.examPanel.hidden = mode !== "exam";
  startSession();
}

function startSession() {
  const random = state.scope.type === "all";
  state.session = createSessionQuestions(state.questions, {
    scope: state.scope.type === "wrong" ? "wrong" : state.scope.type === "set" ? "set" : "all",
    setName: state.scope.setName,
    random,
    wrongIds: [...state.wrongIds],
  });
  state.currentIndex = 0;
  render();
}

function selectAnswer(question, key) {
  const current = new Set(state.answersById[question.id] || []);
  if (question.type === "multiple") {
    if (current.has(key)) current.delete(key);
    else current.add(key);
    state.answersById[question.id] = normalizeAnswer([...current]);
  } else {
    state.answersById[question.id] = [key];
  }

  if (state.mode === "practice") {
    state.checkedById[question.id] = true;
    if (!isAnswerCorrect(state.answersById[question.id], question.answer)) {
      state.wrongIds.add(question.id);
      saveWrongIds();
    }
  }

  render();
}

function renderScopeButtons() {
  const sets = [...new Set(state.questions.map((question) => question.set))];
  const buttons = [
    `<button class="scope-button ${state.scope.type === "all" ? "is-active" : ""}" data-scope="all" type="button">全部随机 <span>${state.questions.length}</span></button>`,
    ...sets.map((setName) => {
      const count = state.questions.filter((question) => question.set === setName).length;
      const active = state.scope.type === "set" && state.scope.setName === setName;
      return `<button class="scope-button ${active ? "is-active" : ""}" data-scope="set" data-set="${setName}" type="button">${setName} <span>${count}</span></button>`;
    }),
  ];
  elements.scopeButtons.innerHTML = buttons.join("");
  elements.wrongScopeButton.classList.toggle("is-active", state.scope.type === "wrong");
  elements.wrongScopeButton.textContent = `错题本 ${state.wrongIds.size}`;
}

function renderQuestion() {
  const question = getCurrentQuestion();
  if (!question) {
    elements.questionMeta.textContent = "";
    elements.questionText.textContent = "当前范围没有题目";
    elements.optionsList.innerHTML = "";
    elements.feedbackPanel.hidden = true;
    elements.prevButton.disabled = true;
    elements.nextButton.disabled = true;
    return;
  }

  elements.questionMeta.textContent = `${question.set} · 第 ${state.currentIndex + 1} / ${state.session.length} 题 · ${question.typeLabel || question.type}`;
  elements.questionText.textContent = question.question;
  const selected = new Set(state.answersById[question.id] || []);
  const checked = Boolean(state.checkedById[question.id]);
  elements.optionsList.innerHTML = question.options
    .map((option) => {
      const active = selected.has(option.key);
      const correct = checked && question.answer.includes(option.key);
      const wrong = checked && active && !question.answer.includes(option.key);
      return `<button class="option-button ${active ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}" data-option="${option.key}" type="button"><strong>${option.key}.</strong> ${option.text}</button>`;
    })
    .join("");

  if (state.mode === "practice" && checked) {
    const ok = isAnswerCorrect(state.answersById[question.id] || [], question.answer);
    elements.feedbackPanel.hidden = false;
    elements.feedbackPanel.className = `feedback-panel ${ok ? "is-correct" : "is-wrong"}`;
    elements.feedbackPanel.innerHTML = `<strong>${ok ? "答对了" : "答错了"}</strong><p>正确答案：${question.answer.join("、")}</p><p>${question.explanation || "暂无解析"}</p>`;
  } else {
    elements.feedbackPanel.hidden = true;
  }

  elements.prevButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = state.currentIndex >= state.session.length - 1;
  elements.removeWrongButton.hidden = !state.wrongIds.has(question.id);
}

function renderPracticeStats() {
  const answered = Object.keys(state.checkedById).length;
  elements.practiceStats.innerHTML = `
    <h2>练习统计</h2>
    <p>当前题量：${state.session.length}</p>
    <p>已练习：${answered}</p>
    <p>错题本：${state.wrongIds.size}</p>
  `;
}

function renderAnswerCard() {
  elements.answerCard.innerHTML = state.session
    .map((question, index) => {
      const answered = (state.answersById[question.id] || []).length > 0;
      return `<button class="${answered ? "is-answered" : ""} ${index === state.currentIndex ? "is-current" : ""}" data-index="${index}" type="button">${index + 1}</button>`;
    })
    .join("");
}

function render() {
  elements.appSummary.textContent = `${state.questions.length} 题 · ${state.mode === "practice" ? "练习模式" : "考试模式"}`;
  renderScopeButtons();
  renderQuestion();
  renderPracticeStats();
  renderAnswerCard();
}

function submitExam() {
  const result = scoreExam(state.session, state.answersById);
  for (const id of result.wrongIds) state.wrongIds.add(id);
  saveWrongIds();
  state.session.forEach((question) => {
    state.checkedById[question.id] = true;
  });
  elements.resultDialog.hidden = false;
  elements.resultDialog.innerHTML = `
    <div class="result-card">
      <button class="close-result" type="button" aria-label="关闭">×</button>
      <h2>考试结果</h2>
      <p>${result.correct} / ${result.total} 题正确，得分 ${result.percent}</p>
      <p>错题已加入错题本：${result.wrongIds.length} 题</p>
    </div>
  `;
  render();
}

function bindEvents() {
  elements.practiceModeButton.addEventListener("click", () => setMode("practice"));
  elements.examModeButton.addEventListener("click", () => setMode("exam"));
  elements.scopeButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    state.scope = button.dataset.scope === "set" ? { type: "set", setName: button.dataset.set } : { type: "all", setName: null };
    startSession();
  });
  elements.wrongScopeButton.addEventListener("click", () => {
    state.scope = { type: "wrong", setName: null };
    startSession();
  });
  elements.optionsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-option]");
    const question = getCurrentQuestion();
    if (button && question) selectAnswer(question, button.dataset.option);
  });
  elements.prevButton.addEventListener("click", () => {
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    render();
  });
  elements.nextButton.addEventListener("click", () => {
    state.currentIndex = Math.min(state.session.length - 1, state.currentIndex + 1);
    render();
  });
  elements.removeWrongButton.addEventListener("click", () => {
    const question = getCurrentQuestion();
    if (!question) return;
    state.wrongIds.delete(question.id);
    saveWrongIds();
    render();
  });
  elements.answerCard.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    state.currentIndex = Number(button.dataset.index);
    render();
  });
  elements.submitExamButton.addEventListener("click", submitExam);
  elements.resultDialog.addEventListener("click", (event) => {
    if (event.target.matches(".close-result")) elements.resultDialog.hidden = true;
  });
}

async function init() {
  bindEvents();
  state.wrongIds = loadWrongIds();
  const response = await fetch("./data/questions.json");
  if (!response.ok) throw new Error(`Failed to load questions: ${response.status}`);
  state.questions = await response.json();
  startSession();
}

init().catch((error) => {
  console.error(error);
  elements.questionText.textContent = "题库加载失败，请检查 data/questions.json。";
});
```

- [ ] **Step 2: Check JavaScript syntax**

Run:

```powershell
node --check app.js
node --check src/quiz-core.mjs
```

Expected: both commands exit successfully.

- [ ] **Step 3: Run logic tests and data validation**

Run:

```powershell
node tools/core-tests.mjs
node tools/validate-questions.mjs
```

Expected:

```text
core tests passed
question validation passed
```

- [ ] **Step 4: Commit app behavior**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/app.js'
git commit -m "feat: add quiz app behavior"
```

Expected: commit includes `app.js`.

---

### Task 7: Responsive Styling

**Files:**
- Create: `C:/Users/Mrliao/Desktop/移动应用开发题库/styles.css`

- [ ] **Step 1: Create stylesheet**

Create `styles.css`:

```css
:root {
  color-scheme: light;
  --bg: #f6f7fb;
  --panel: #ffffff;
  --text: #1f2933;
  --muted: #667085;
  --line: #d9dee8;
  --blue: #1570ef;
  --blue-soft: #eaf4ff;
  --green: #18a058;
  --green-soft: #ecfdf3;
  --red: #d92d20;
  --red-soft: #fff1f0;
  --orange: #b54708;
  --orange-soft: #fff6ed;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, "Microsoft YaHei", sans-serif;
}

button {
  font: inherit;
}

.app-header {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}

.app-header h1 {
  margin: 0;
  font-size: 22px;
}

.app-header p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.mode-switch {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f9fafb;
}

.mode-switch button,
.scope-button,
.quiz-actions button,
.primary-button {
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text);
  padding: 9px 12px;
  cursor: pointer;
}

.mode-switch button.is-active,
.scope-button.is-active,
.primary-button {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}

.app-layout {
  min-height: calc(100vh - 72px);
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 220px;
}

.sidebar,
.side-panel {
  background: var(--panel);
  padding: 16px;
}

.sidebar {
  border-right: 1px solid var(--line);
}

.side-panel {
  border-left: 1px solid var(--line);
}

.sidebar h2,
.side-panel h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.scope-list {
  display: grid;
  gap: 8px;
}

.scope-button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
}

.wrong-scope {
  margin-top: 14px;
  border-color: #f2cda7;
  background: var(--orange-soft);
  color: var(--orange);
}

.quiz-panel {
  padding: 24px 32px;
}

.question-meta {
  min-height: 20px;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 12px;
}

.question-text {
  margin: 0 0 20px;
  font-size: 24px;
  line-height: 1.45;
}

.options-list {
  display: grid;
  gap: 10px;
}

.option-button {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 13px 14px;
  text-align: left;
  line-height: 1.5;
  cursor: pointer;
}

.option-button.is-selected {
  border-color: var(--blue);
  background: var(--blue-soft);
}

.option-button.is-correct {
  border-color: var(--green);
  background: var(--green-soft);
}

.option-button.is-wrong {
  border-color: var(--red);
  background: var(--red-soft);
}

.feedback-panel {
  margin-top: 16px;
  padding: 14px;
  border-left: 4px solid var(--line);
  background: var(--panel);
  line-height: 1.6;
}

.feedback-panel p {
  margin: 6px 0 0;
}

.feedback-panel.is-correct {
  border-left-color: var(--green);
  background: var(--green-soft);
}

.feedback-panel.is-wrong {
  border-left-color: var(--red);
  background: var(--red-soft);
}

.quiz-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 18px;
}

.answer-card {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
}

.answer-card button {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #eef2f6;
  padding: 7px 0;
  cursor: pointer;
}

.answer-card button.is-answered {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}

.answer-card button.is-current {
  outline: 2px solid #111827;
  outline-offset: 2px;
}

.result-dialog {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.35);
}

.result-card {
  width: min(420px, 100%);
  border-radius: 8px;
  background: var(--panel);
  padding: 20px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
}

.close-result {
  float: right;
  border: 0;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar,
  .side-panel {
    border: 0;
    border-bottom: 1px solid var(--line);
  }

  .scope-list {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }

  .quiz-panel {
    padding: 20px 16px;
  }

  .question-text {
    font-size: 20px;
  }
}
```

- [ ] **Step 2: Run syntax checks**

Run:

```powershell
node --check app.js
node tools/core-tests.mjs
node tools/validate-questions.mjs
```

Expected:

```text
core tests passed
question validation passed
```

- [ ] **Step 3: Commit styling**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/styles.css'
git commit -m "style: add responsive quiz layout"
```

Expected: commit includes `styles.css`.

---

### Task 8: Local QA And Final Fixes

**Files:**
- Modify as needed based on QA:
  - `C:/Users/Mrliao/Desktop/移动应用开发题库/index.html`
  - `C:/Users/Mrliao/Desktop/移动应用开发题库/styles.css`
  - `C:/Users/Mrliao/Desktop/移动应用开发题库/app.js`
  - `C:/Users/Mrliao/Desktop/移动应用开发题库/data/questions.json`

- [ ] **Step 1: Run all command-line checks**

Run from `C:/Users/Mrliao/Desktop/移动应用开发题库`:

```powershell
node --check app.js
node --check src/quiz-core.mjs
node tools/core-tests.mjs
node tools/validate-questions.mjs
```

Expected:

```text
core tests passed
question validation passed
```

- [ ] **Step 2: Start a local static server**

Run:

```powershell
python -m http.server 8080
```

Expected: server prints a message including `Serving HTTP on`.

- [ ] **Step 3: Browser QA on desktop width**

Open:

```text
http://localhost:8080
```

Verify:

```text
The header shows 140 questions.
The left sidebar shows 全部随机, 测验1, 测验2, 测验3, 测试4, 测试5, 测试6, 错题本.
练习 mode gives immediate feedback after selecting an option.
Multiple-choice questions allow multiple selections.
判断题 shows A. 对 and B. 错.
Switching to 考试 hides feedback.
交卷 shows score and adds wrong IDs to localStorage.
错题本 still contains wrong questions after page refresh.
移出错题 removes the current question from 错题本.
```

- [ ] **Step 4: Browser QA on mobile width**

Resize the browser to around `390 x 844`.

Verify:

```text
No text overlaps.
Options stay inside their containers.
Sidebar content stacks above the question panel.
Answer card remains tappable.
Header buttons remain readable.
```

- [ ] **Step 5: Fix any QA failures and rerun checks**

After each fix, rerun:

```powershell
node --check app.js
node --check src/quiz-core.mjs
node tools/core-tests.mjs
node tools/validate-questions.mjs
```

Expected:

```text
core tests passed
question validation passed
```

- [ ] **Step 6: Commit final QA fixes**

Run from `C:/Users/Mrliao`:

```powershell
git add -- 'Desktop/移动应用开发题库/index.html' 'Desktop/移动应用开发题库/styles.css' 'Desktop/移动应用开发题库/app.js' 'Desktop/移动应用开发题库/src/quiz-core.mjs' 'Desktop/移动应用开发题库/data/questions.json' 'Desktop/移动应用开发题库/tools'
git commit -m "fix: polish quiz app qa"
```

Expected: commit includes only files needed for the quiz app.

---

## Self-Review

**Spec coverage:** This plan covers the approved spec: all 140 questions, split by source set, all-random mode, practice mode, exam mode, wrong-question-only persistence, no original screenshot display, static app delivery, validator, and desktop/mobile QA.

**Placeholder scan:** The plan contains no `TBD`, `TODO`, or intentionally vague implementation steps. The data-entry task references the source screenshots directly because the 140 final records must be transcribed from those source files, not invented in the plan.

**Type consistency:** Question records use `id`, `set`, `number`, `type`, `question`, `options`, `answer`, `explanation`, and optional `source`. Core functions and `app.js` both use the same `answer` array shape and question IDs.
