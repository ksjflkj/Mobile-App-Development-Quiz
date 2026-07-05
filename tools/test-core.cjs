const fs = require('fs');
const path = require('path');

// Simulate browser global window object
global.window = global;
require('../src/quiz-core.js');

const core = global.window.QuizCore;

if (!core) {
  console.error('❌ QuizCore 未挂载到 window 对象上');
  process.exit(1);
}

try {
  // 1. normalizeAnswer tests
  const a1 = core.normalizeAnswer([' a ', 'B', 'a']);
  if (JSON.stringify(a1) !== JSON.stringify(['A', 'B'])) {
    throw new Error('normalizeAnswer 失败: ' + JSON.stringify(a1));
  }

  const a2 = core.normalizeAnswer([123, '  c  ', null, undefined, 'c']);
  if (JSON.stringify(a2) !== JSON.stringify(['123', 'C'])) {
    throw new Error('normalizeAnswer 带有空值的处理失败: ' + JSON.stringify(a2));
  }

  // 2. isAnswerCorrect tests
  if (!core.isAnswerCorrect(['A', 'B'], ['b', 'a'])) {
    throw new Error('isAnswerCorrect 乱序失败');
  }
  if (core.isAnswerCorrect(['A'], ['A', 'B'])) {
    throw new Error('isAnswerCorrect 多余选项失败');
  }

  // 3. scoreExam tests
  const questions = [
    { id: '1', answer: ['A'] },
    { id: '2', answer: ['B', 'C'] },
    { id: '3', answer: ['D'] }
  ];
  const answers = {
    '1': ['A'],   // Correct
    '2': ['B'],   // Incorrect
    '3': []       // Unanswered (Incorrect)
  };
  const score = core.scoreExam(questions, answers);
  if (score.correct !== 1 || score.percent !== 33 || score.wrong !== 2 || score.total !== 3) {
    throw new Error('scoreExam 失败: ' + JSON.stringify(score));
  }
  if (!score.wrongIds.includes('2') || !score.wrongIds.includes('3')) {
    throw new Error('scoreExam 错题ID统计错误: ' + JSON.stringify(score.wrongIds));
  }

  // 4. shuffleQuestions & seededRandom tests
  const questionsToShuffle = [
    { id: '1', set: 'a', number: 1 },
    { id: '2', set: 'a', number: 2 },
    { id: '3', set: 'b', number: 1 }
  ];
  const shuffled1 = core.shuffleQuestions(questionsToShuffle, 42);
  const shuffled2 = core.shuffleQuestions(questionsToShuffle, 42);
  if (JSON.stringify(shuffled1) !== JSON.stringify(shuffled2)) {
    throw new Error('shuffleQuestions 种子随机性不一致');
  }

  // 5. createSessionQuestions tests
  const sessionSet = core.createSessionQuestions(questionsToShuffle, {
    scope: 'set',
    setName: 'a',
    random: false
  });
  if (sessionSet.length !== 2 || sessionSet[0].id !== '1' || sessionSet[1].id !== '2') {
    throw new Error('createSessionQuestions 按单元过滤失败: ' + JSON.stringify(sessionSet));
  }

  const sessionWrong = core.createSessionQuestions(questionsToShuffle, {
    scope: 'wrong',
    wrongIds: ['2', '3'],
    random: false
  });
  if (sessionWrong.length !== 2 || sessionWrong[0].id !== '2' || sessionWrong[1].id !== '3') {
    throw new Error('createSessionQuestions 错题本过滤失败: ' + JSON.stringify(sessionWrong));
  }

  console.log('✅ quiz-core.js 所有单元测试通过！');
} catch (err) {
  console.error('❌ 测试失败:', err.message);
  process.exit(1);
}
