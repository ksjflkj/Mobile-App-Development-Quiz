import assert from "node:assert/strict";
import {
  normalizeAnswer,
  isAnswerCorrect,
  scoreExam,
  createSessionQuestions,
} from "../src/quiz-core.js";

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

const limitedRandom = createSessionQuestions(sampleQuestions, {
  scope: "set",
  setName: "测验1",
  random: true,
  seed: 42,
  limit: 1,
});
assert.equal(limitedRandom.length, 1);
assert.equal(limitedRandom[0].set, "测验1");

console.log("core tests passed");
