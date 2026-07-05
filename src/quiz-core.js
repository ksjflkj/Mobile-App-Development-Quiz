(function () {
  function normalizeAnswer(answer) {
    if (!answer || !Array.isArray(answer)) return [];
    return [...new Set(answer.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))].sort();
  }

  function isAnswerCorrect(selected, correct) {
    const left = normalizeAnswer(selected);
    const right = normalizeAnswer(correct);
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function scoreExam(questions, answersById) {
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

  function shuffleQuestions(questions, seed = Date.now()) {
    const random = seededRandom(seed);
    const result = [...questions];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function createSessionQuestions(questions, options) {
    const { scope, setName, random = false, seed = Date.now(), wrongIds = [], limit = null } = options;
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

    if (random) result = shuffleQuestions(result, seed);
    if (Number.isInteger(limit) && limit > 0) result = result.slice(0, limit);

    return result;
  }

  // 挂载至全局，兼容浏览器和 Node 测试环境
  const globalObj = typeof window !== 'undefined' ? window : global;
  globalObj.QuizCore = {
    normalizeAnswer,
    isAnswerCorrect,
    scoreExam,
    shuffleQuestions,
    createSessionQuestions
  };
})();
