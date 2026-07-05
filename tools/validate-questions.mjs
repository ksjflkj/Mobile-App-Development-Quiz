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
const forbiddenTextPatterns = [
  { pattern: /ffl/i, label: "corrupted flex text" },
  { pattern: /文字颜色色/, label: "duplicated color character" },
];

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
  if (typeof question.question !== "string" || question.question.trim().length < 4) {
    fail(`${question.id} question text is too short`);
  }
  if (typeof question.explanation !== "string") fail(`${question.id} explanation must be a string`);

  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
    fail(`${question.id} options length must be 2-4`);
  }

  const optionKeys = new Set(question.options.map((option) => option.key));
  for (const option of question.options) {
    if (!validOptionKeys.has(option.key)) fail(`${question.id} invalid option key ${option.key}`);
    if (typeof option.text !== "string" || option.text.trim() === "") {
      fail(`${question.id} has empty option ${option.key}`);
    }
  }

  for (const [fieldName, text] of [
    ["question", question.question],
    ["explanation", question.explanation],
    ...question.options.map((option) => [`option ${option.key}`, option.text]),
  ]) {
    for (const { pattern, label } of forbiddenTextPatterns) {
      if (pattern.test(text)) fail(`${question.id} ${fieldName} contains ${label}: ${text}`);
    }
  }

  if (question.type === "judge") {
    const texts = question.options.map((option) => option.text).join("|");
    if (question.options.length !== 2 || texts !== "对|错") {
      fail(`${question.id} judge options must be A. 对 and B. 错`);
    }
  }

  if (!Array.isArray(question.answer) || question.answer.length === 0) {
    fail(`${question.id} answer must be a non-empty array`);
  }
  for (const key of question.answer) {
    if (!optionKeys.has(key)) fail(`${question.id} answer ${key} is not present in options`);
  }

  if (question.type === "single" && question.answer.length !== 1) fail(`${question.id} single answer must have one key`);
  if (question.type === "multiple" && question.answer.length < 2) {
    fail(`${question.id} multiple answer must have at least two keys`);
  }
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
