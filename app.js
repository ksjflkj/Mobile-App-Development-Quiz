(function () {
  const wrongStorageKey = "mobile-quiz-wrong-ids";
  const progressStorageKey = "mobile-quiz-progress";
  const themeStorageKey = "mobile-quiz-theme";

  const typeLabels = {
    single: "单选题",
    multiple: "多选题",
    judge: "判断题",
  };

  // 系统状态
  const state = {
    questions: [],             // 全部题目
    session: [],               // 当前作答题集
    mode: "practice",          // 'practice' (单元练习/随机抽题) | 'exam' (限时考试)
    scope: { type: "all", setName: null },
    examConfig: { limit: 20, time: 30 }, // 题量，限时(分钟)
    currentIndex: 0,
    answersById: {},           // 已填写的答案
    checkedById: {},           // 练习模式下是否判题/检查过
    wrongIds: new Set(),       // 错题本ID
    progress: {},              // 各单元答过题目的进度追踪
    examSubmitted: false,
    timerId: null,             // 倒计时定时器
    timeLeft: 0,               // 倒计时剩余秒数
    lastScoreText: "",         // 最近一次考试记录
  };

  // DOM 元素引用
  let elements = {};

  function initDomElements() {
    elements = {
      appSummary: document.querySelector("#appSummary"),
      themeToggleButton: document.querySelector("#themeToggleButton"),
      dashboardView: document.querySelector("#dashboardView"),
      quizView: document.querySelector("#quizView"),
      
      // 首页仪表盘
      statsTotalCount: document.querySelector("#statsTotalCount"),
      statsWrongCount: document.querySelector("#statsWrongCount"),
      statsExamRecord: document.querySelector("#statsExamRecord"),
      wrongCardButton: document.querySelector("#wrongCardButton"),
      quickRandomBtn: document.querySelector("#quickRandomBtn"),
      quickExamBtn: document.querySelector("#quickExamBtn"),
      unitGrid: document.querySelector("#unitGrid"),
      
      // 答题工作区
      backToHomeBtn: document.querySelector("#backToHomeBtn"),
      examTimerPanel: document.querySelector("#examTimerPanel"),
      examTimerDisplay: document.querySelector("#examTimerDisplay"),
      quizProgressTitle: document.querySelector("#quizProgressTitle"),
      quizProgressText: document.querySelector("#quizProgressText"),
      quizCorrectRateText: document.querySelector("#quizCorrectRateText"),
      answerCard: document.querySelector("#answerCard"),
      submitExamButton: document.querySelector("#submitExamButton"),
      
      // 做题面板
      questionMeta: document.querySelector("#questionMeta"),
      questionText: document.querySelector("#questionText"),
      optionsList: document.querySelector("#optionsList"),
      confirmAnswerBtn: document.querySelector("#confirmAnswerBtn"),
      feedbackPanel: document.querySelector("#feedbackPanel"),
      prevButton: document.querySelector("#prevButton"),
      nextButton: document.querySelector("#nextButton"),
      removeWrongButton: document.querySelector("#removeWrongButton"),
      
      // 配置模态框
      configModal: document.querySelector("#configModal"),
      configModalTitle: document.querySelector("#configModalTitle"),
      configQuestionSize: document.querySelector("#configQuestionSize"),
      configTimeFormItem: document.querySelector("#configTimeFormItem"),
      configTimeLimit: document.querySelector("#configTimeLimit"),
      cancelConfigBtn: document.querySelector("#cancelConfigBtn"),
      startQuizBtn: document.querySelector("#startQuizBtn"),
      
      // 考试结果
      resultDialog: document.querySelector("#resultDialog"),
      closeResultBtn: document.querySelector("#closeResultBtn"),
      resultScore: document.querySelector("#resultScore"),
      resultFeedbackText: document.querySelector("#resultFeedbackText"),
      wrongList: document.querySelector("#wrongList"),
    };
  }

  // 常用辅助方法
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function loadLocalStorage() {
    // 错题本
    try {
      state.wrongIds = new Set(JSON.parse(localStorage.getItem(wrongStorageKey) || "[]"));
    } catch {
      state.wrongIds = new Set();
    }

    // 学习进度
    try {
      state.progress = JSON.parse(localStorage.getItem(progressStorageKey) || "{}");
    } catch {
      state.progress = {};
    }

    // 题库最近一次考试记录
    const lastScore = localStorage.getItem("mobile-quiz-last-score");
    state.lastScoreText = lastScore || "暂无记录";
  }

  function saveWrongIds() {
    localStorage.setItem(wrongStorageKey, JSON.stringify([...state.wrongIds]));
  }

  function saveProgress(questionId, setName) {
    if (!setName) return;
    if (!state.progress[setName]) {
      state.progress[setName] = [];
    }
    if (!state.progress[setName].includes(questionId)) {
      state.progress[setName].push(questionId);
      localStorage.setItem(progressStorageKey, JSON.stringify(state.progress));
    }
  }

  function getCurrentQuestion() {
    return state.session[state.currentIndex] || null;
  }

  function resetSessionState() {
    state.answersById = {};
    state.checkedById = {};
    state.currentIndex = 0;
    state.examSubmitted = false;
    elements.resultDialog.hidden = true;
    clearInterval(state.timerId);
    elements.examTimerPanel.hidden = true;
    elements.submitExamButton.hidden = true;
  }

  function saveSessionRecord(isFinished = false) {
    if (state.session.length === 0) return;

    const total = state.session.length;
    const answered = Object.keys(state.answersById).length;

    if (state.mode === "exam") {
      if (state.examSubmitted) {
        return;
      }
      if (answered > 0) {
        const recordText = `测验未交卷 (已答 ${answered}/${total} 题)`;
        localStorage.setItem("mobile-quiz-last-score", recordText);
      }
      return;
    }

    // 练习模式
    if (answered > 0) {
      let correctCount = 0;
      let checkedCount = 0;
      state.session.forEach((q) => {
        if (state.checkedById[q.id]) {
          checkedCount++;
          if (window.QuizCore.isAnswerCorrect(state.answersById[q.id] || [], q.answer)) {
            correctCount++;
          }
        }
      });

      const scopeName = state.scope.type === "set" 
        ? state.scope.setName 
        : (state.scope.type === "wrong" ? "错题复习" : "随机练习");
        
      let recordText = "";
      if (isFinished || answered === total) {
        recordText = `练习完成: ${scopeName} (对 ${correctCount}/共 ${total} 题)`;
      } else {
        recordText = `练习中: ${scopeName} (已答 ${answered}/${total} 题)`;
      }
      localStorage.setItem("mobile-quiz-last-score", recordText);
    }
  }

  function updateAppSummary() {
    const modeText = state.mode === "practice" 
      ? (state.scope.type === "wrong" ? "错题本模式" : (state.scope.type === "all" ? "全部随机练习" : `单元测试: ${state.scope.setName}`))
      : `限时测验 (${state.session.length}题)`;
    elements.appSummary.textContent = `${state.questions.length} 题 · ${modeText}`;
  }

  // 视图切换
  function showView(view) {
    if (view === "dashboard") {
      elements.dashboardView.hidden = false;
      elements.quizView.hidden = true;
      renderDashboard();
    } else {
      elements.dashboardView.hidden = true;
      elements.quizView.hidden = false;
    }
  }

  // 主题切换
  function initTheme() {
    const savedTheme = localStorage.getItem(themeStorageKey) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    elements.themeToggleButton.querySelector(".theme-icon").textContent = savedTheme === "dark" ? "☀️" : "🌙";
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
    elements.themeToggleButton.querySelector(".theme-icon").textContent = nextTheme === "dark" ? "☀️" : "🌙";
  }

  // 1. 渲染首页仪表盘
  function renderDashboard() {
    loadLocalStorage();
    elements.statsTotalCount.textContent = `${state.questions.length} 题`;
    elements.statsWrongCount.textContent = `${state.wrongIds.size} 题`;
    elements.statsExamRecord.textContent = state.lastScoreText;

    // 提取所有单元名称并去重排序
    const sets = [...new Set(state.questions.map((q) => q.set))].sort((a, b) => {
      return String(a).localeCompare(String(b), "zh-Hans-CN");
    });
    
    elements.unitGrid.innerHTML = sets.map((setName) => {
      const totalInSet = state.questions.filter((q) => q.set === setName).length;
      const answeredList = state.progress[setName] || [];
      // 过滤出该单元内真实存在的题目，避免脏数据影响
      const validAnswered = answeredList.filter(id => {
        const q = state.questions.find(item => item.id === id);
        return q && q.set === setName;
      });
      const answeredCount = validAnswered.length;
      const progressPercent = totalInSet === 0 ? 0 : Math.round((answeredCount / totalInSet) * 100);

      return `
        <div class="unit-card">
          <div>
            <div class="unit-card-title">${escapeHtml(setName)}</div>
            <div class="unit-card-count">共 ${totalInSet} 道题目</div>
          </div>
          <div class="unit-progress-container">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="unit-progress-label">
              <span>进度: ${answeredCount}/${totalInSet}</span>
              <span>${progressPercent}%</span>
            </div>
          </div>
          <button class="unit-card-btn" data-set-name="${escapeHtml(setName)}" type="button">进入单元</button>
        </div>
      `;
    }).join("");
  }

  // 2. 渲染题目
  function answerText(question) {
    const optionByKey = new Map(question.options.map((option) => [option.key, option.text]));
    return question.answer.map((key) => `${key}. ${optionByKey.get(key) || ""}`).join("；");
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
      elements.removeWrongButton.hidden = true;
      return;
    }

    elements.questionMeta.textContent = `${question.set} · 第 ${state.currentIndex + 1} / ${state.session.length} 题`;
    
    // 在题目前面添加醒目的题目类型 badge 标签
    const typeBadge = `<span class="question-type-inline-badge">${typeLabels[question.type]}</span>`;
    elements.questionText.innerHTML = `${typeBadge}${escapeHtml(question.question)}`;

    const selected = new Set(state.answersById[question.id] || []);
    const checked = state.examSubmitted || Boolean(state.checkedById[question.id]);
    
    elements.optionsList.innerHTML = question.options
      .map((option) => {
        const active = selected.has(option.key);
        const correct = checked && question.answer.includes(option.key);
        const wrong = checked && active && !question.answer.includes(option.key);
        
        return `
          <button class="option-button ${active ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}" data-option="${escapeHtml(option.key)}" type="button">
            <strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.text)}
          </button>
        `;
      })
      .join("");

    if (checked) {
      const ok = window.QuizCore.isAnswerCorrect(state.answersById[question.id] || [], question.answer);
      elements.feedbackPanel.hidden = false;
      elements.feedbackPanel.className = `feedback-panel ${ok ? "is-correct" : "is-wrong"}`;
      elements.feedbackPanel.innerHTML = `
        <h4>${ok ? "🎉 回答正确" : "❌ 回答错误"}</h4>
        <p><strong>正确答案：</strong>${escapeHtml(answerText(question))}</p>
        <p><strong>解析：</strong>${escapeHtml(question.explanation || "暂无解析")}</p>
      `;
    } else {
      elements.feedbackPanel.hidden = true;
    }

    // 控制多选题“确认答案”按钮的显示与禁用状态 (仅多选题在练习模式未提交时显示)
    if (state.mode === "practice" && question.type === "multiple" && !state.checkedById[question.id]) {
      elements.confirmAnswerBtn.hidden = false;
      const selectedCount = (state.answersById[question.id] || []).length;
      elements.confirmAnswerBtn.disabled = selectedCount === 0;
    } else {
      elements.confirmAnswerBtn.hidden = true;
    }

    elements.prevButton.disabled = state.currentIndex === 0;
    
    // 如果是练习模式，且在最后一题，将“下一题”变为“完成练习”按钮以引导返回首页
    if (state.mode === "practice" && state.currentIndex === state.session.length - 1) {
      elements.nextButton.textContent = "完成练习";
      elements.nextButton.disabled = false;
      elements.nextButton.classList.add("finish-practice-btn");
    } else {
      elements.nextButton.textContent = "下一题";
      elements.nextButton.disabled = state.currentIndex >= state.session.length - 1;
      elements.nextButton.classList.remove("finish-practice-btn");
    }

    elements.removeWrongButton.hidden = !state.wrongIds.has(question.id);
  }

  // 3. 渲染侧边栏和答题卡
  function renderSidebar() {
    elements.quizProgressTitle.textContent = state.mode === "practice" ? "练习进度" : "答题卡进度";
    const totalCount = state.session.length;
    const answeredCount = Object.keys(state.answersById).length;
    elements.quizProgressText.textContent = `${answeredCount} / ${totalCount} 题`;

    // 计算正确率 (仅限练习模式下)
    if (state.mode === "practice" && answeredCount > 0) {
      let checkedCount = 0;
      let correctCount = 0;
      state.session.forEach((q) => {
        if (state.checkedById[q.id]) {
          checkedCount++;
          if (window.QuizCore.isAnswerCorrect(state.answersById[q.id] || [], q.answer)) {
            correctCount++;
          }
        }
      });
      if (checkedCount > 0) {
        const percent = Math.round((correctCount / checkedCount) * 100);
        elements.quizCorrectRateText.textContent = `正确率: ${percent}% (对 ${correctCount} / 错 ${checkedCount - correctCount})`;
      } else {
        elements.quizCorrectRateText.textContent = "";
      }
    } else {
      elements.quizCorrectRateText.textContent = "";
    }

    // 答题卡
    elements.answerCard.innerHTML = state.session
      .map((question, index) => {
        const isCurrent = index === state.currentIndex;
        const isAnswered = (state.answersById[question.id] || []).length > 0;
        
        let stateClass = "";
        if (isAnswered) stateClass = "is-answered";
        
        // 练习模式下直观展示对错
        if (state.mode === "practice" && state.checkedById[question.id]) {
          const isCorrect = window.QuizCore.isAnswerCorrect(state.answersById[question.id] || [], question.answer);
          stateClass = isCorrect ? "practice-correct" : "practice-wrong";
        }

        return `
          <button class="${stateClass} ${isCurrent ? "is-current" : ""}" data-index="${index}" type="button">
            ${index + 1}
          </button>
        `;
      })
      .join("");

    elements.submitExamButton.hidden = state.mode !== "exam" || state.examSubmitted;
  }

  function render() {
    updateAppSummary();
    renderQuestion();
    renderSidebar();
  }

  // 交互逻辑
  function startSession() {
    const isRandom = state.mode === "exam" || state.scope.type === "all";
    state.session = window.QuizCore.createSessionQuestions(state.questions, {
      scope: state.scope.type === "wrong" ? "wrong" : (state.scope.type === "set" ? "set" : "all"),
      setName: state.scope.setName,
      random: isRandom,
      limit: (state.mode === "exam" || state.scope.type === "all") ? state.examConfig.limit : null,
      wrongIds: [...state.wrongIds],
    });

    resetSessionState();
    
    if (state.session.length === 0) {
      alert("当前范围内没有题目，请重新选择。");
      showView("dashboard");
      return;
    }

    if (state.mode === "exam") {
      startExamTimer();
    }

    showView("quiz");
    render();
  }

  function selectAnswer(question, optionKey) {
    if (state.examSubmitted) return;

    // 如果是练习模式下的多选题，且已经提交过答案，则不能再修改
    if (state.mode === "practice" && question.type === "multiple" && state.checkedById[question.id]) return;

    const currentAnswers = new Set(state.answersById[question.id] || []);
    if (question.type === "multiple") {
      if (currentAnswers.has(optionKey)) {
        currentAnswers.delete(optionKey);
      } else {
        currentAnswers.add(optionKey);
      }
      state.answersById[question.id] = window.QuizCore.normalizeAnswer([...currentAnswers]);
    } else {
      // 单选题/判断题
      state.answersById[question.id] = [optionKey];
    }

    // 保存进度
    saveProgress(question.id, question.set);

    if (state.mode === "practice") {
      if (question.type === "multiple") {
        // 多选题练习模式下：仅更新选择，不进行判题，直至点击“确认答案”
        render();
        return;
      }

      state.checkedById[question.id] = true;
      // 自动移出/记入错题本
      const isCorrect = window.QuizCore.isAnswerCorrect(state.answersById[question.id], question.answer);
      if (isCorrect) {
        state.wrongIds.delete(question.id);
      } else {
        state.wrongIds.add(question.id);
      }
      saveWrongIds();
    }

    render();
  }

  // 倒计时
  function startExamTimer() {
    state.timeLeft = state.examConfig.time * 60;
    elements.examTimerPanel.hidden = false;
    updateTimerDisplay();

    state.timerId = setInterval(() => {
      state.timeLeft--;
      updateTimerDisplay();

      if (state.timeLeft <= 180) {
        elements.examTimerPanel.classList.add("warning-time");
      } else {
        elements.examTimerPanel.classList.remove("warning-time");
      }

      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        alert("时间到，系统已自动交卷！");
        submitExam();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    elements.examTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // 交卷
  function submitExam() {
    clearInterval(state.timerId);
    const result = window.QuizCore.scoreExam(state.session, state.answersById);
    
    // 记录错题
    result.wrongIds.forEach(id => state.wrongIds.add(id));
    saveWrongIds();

    // 覆盖状态
    state.examSubmitted = true;
    state.session.forEach(q => {
      state.checkedById[q.id] = true;
    });

    // 保存本次得分历史
    const recordText = `${new Date().toLocaleDateString('zh-CN')} ${state.session.length}题 得分${result.percent}`;
    localStorage.setItem("mobile-quiz-last-score", recordText);
    state.lastScoreText = recordText;

    renderExamResult(result);
    render();
  }

  function renderExamResult(result) {
    const questionById = new Map(state.session.map((q) => [q.id, q]));
    const wrongHtml = result.wrongIds
      .map(id => questionById.get(id))
      .filter(Boolean)
      .map(q => `
        <li>
          <strong>[${q.set}] 第 ${q.number} 题 · ${typeLabels[q.type]}</strong>
          <p>${escapeHtml(q.question)}</p>
          <p style="color: var(--success); font-weight: bold; margin-top: 4px;">正确答案：${escapeHtml(answerText(q))}</p>
          <p style="color: var(--text-secondary); margin-top: 4px;">解析：${escapeHtml(q.explanation || "暂无解析")}</p>
        </li>
      `)
      .join("");

    elements.resultScore.textContent = result.percent;
    elements.resultFeedbackText.textContent = `答对 ${result.correct} 题，答错 ${result.wrong} 题，总共 ${result.total} 题`;
    elements.wrongList.innerHTML = wrongHtml || "<li>没有错题，保持这个手感！🎉</li>";
    elements.resultDialog.hidden = false;
  }

  // 绑定事件
  function bindEvents() {
    // 主题切换
    elements.themeToggleButton.addEventListener("click", toggleTheme);

    // 首页卡片及按钮
    elements.wrongCardButton.addEventListener("click", () => {
      state.mode = "practice";
      state.scope = { type: "wrong", setName: null };
      startSession();
    });

    // 首页进入特定单元
    elements.unitGrid.addEventListener("click", (event) => {
      const btn = event.target.closest(".unit-card-btn");
      if (!btn) return;
      const setName = btn.dataset.setName;
      state.mode = "practice";
      state.scope = { type: "set", setName: setName };
      startSession();
    });

    // 快速开始选项
    elements.quickRandomBtn.addEventListener("click", () => {
      state.mode = "practice";
      state.scope = { type: "all", setName: null };
      elements.configModalTitle.textContent = "随机抽题设定";
      elements.configTimeFormItem.hidden = true;
      elements.configModal.hidden = false;
    });

    elements.quickExamBtn.addEventListener("click", () => {
      state.mode = "exam";
      state.scope = { type: "all", setName: null };
      elements.configModalTitle.textContent = "限时考试设定";
      elements.configTimeFormItem.hidden = false;
      elements.configModal.hidden = false;
    });

    // 模态对话框事件
    elements.cancelConfigBtn.addEventListener("click", () => {
      elements.configModal.hidden = true;
    });

    elements.startQuizBtn.addEventListener("click", () => {
      elements.configModal.hidden = true;
      state.examConfig.limit = Number(elements.configQuestionSize.value);
      if (state.mode === "exam") {
        state.examConfig.time = Number(elements.configTimeLimit.value);
      }
      startSession();
    });

    // 答题操作区
    elements.backToHomeBtn.addEventListener("click", () => {
      clearInterval(state.timerId);
      saveSessionRecord(false);
      showView("dashboard");
    });

    elements.optionsList.addEventListener("click", (event) => {
      const btn = event.target.closest(".option-button");
      const question = getCurrentQuestion();
      if (btn && question) {
        selectAnswer(question, btn.dataset.option);
      }
    });

    elements.confirmAnswerBtn.addEventListener("click", () => {
      const question = getCurrentQuestion();
      if (!question) return;

      state.checkedById[question.id] = true;
      // 自动移出/记入错题本
      const isCorrect = window.QuizCore.isAnswerCorrect(state.answersById[question.id] || [], question.answer);
      if (isCorrect) {
        state.wrongIds.delete(question.id);
      } else {
        state.wrongIds.add(question.id);
      }
      saveWrongIds();

      render();
    });

    elements.prevButton.addEventListener("click", () => {
      state.currentIndex = Math.max(0, state.currentIndex - 1);
      render();
    });

    elements.nextButton.addEventListener("click", () => {
      if (state.mode === "practice" && state.currentIndex === state.session.length - 1) {
        saveSessionRecord(true);
        alert("恭喜，您已完成本轮练习！已更新备考状态记录。");
        showView("dashboard");
        return;
      }
      state.currentIndex = Math.min(state.session.length - 1, state.currentIndex + 1);
      render();
    });

    elements.removeWrongButton.addEventListener("click", () => {
      const question = getCurrentQuestion();
      if (!question) return;
      state.wrongIds.delete(question.id);
      saveWrongIds();
      if (state.scope.type === "wrong") {
        startSession();
      } else {
        render();
      }
    });

    elements.answerCard.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-index]");
      if (!btn) return;
      state.currentIndex = Number(btn.dataset.index);
      render();
    });

    elements.submitExamButton.addEventListener("click", () => {
      const total = state.session.length;
      const answered = Object.keys(state.answersById).length;
      if (answered < total) {
        const yes = confirm(`您还有 ${total - answered} 道题未作答，确定交卷吗？`);
        if (!yes) return;
      }
      submitExam();
    });

    elements.closeResultBtn.addEventListener("click", () => {
      elements.resultDialog.hidden = true;
    });
  }

  // 初始化
  function init() {
    initDomElements();
    initTheme();
    bindEvents();
    
    // 读取本地离线数据
    loadLocalStorage();

    // 直接从 window.QUIZ_QUESTIONS 加载题库
    if (window.QUIZ_QUESTIONS && Array.isArray(window.QUIZ_QUESTIONS)) {
      state.questions = window.QUIZ_QUESTIONS;
      showView("dashboard");
    } else {
      document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--error);">
          <h2>数据源加载失败</h2>
          <p>请确保 data/questions-db.js 文件存在并被 index.html 正确加载。</p>
        </div>
      `;
    }
  }

  // 绑定 DOMContentLoaded 触发
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
