# 移动应用开发题库网页刷题系统重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构移动应用开发题库网页刷题系统，消除本地运行的跨域问题，升级为现代高颜值仪表盘式 UI，支持单元测试、随机抽题及带倒计时自动交卷的限时测验。

**Architecture:** 
1. 将题库 JSON 转换为同步加载的 JS 文件，免除 CORS 报错。
2. 剥离 ES Modules 依赖，在 `index.html` 中通过普通的 `<script>` 标签链式引入 `questions-db.js`、`quiz-core.js` 和 `app.js`。
3. 主界面划分为“首页仪表盘”与“答题工作区”两个主要视图，通过 `hidden` 属性控制显隐切换。
4. 全面升级 `styles.css`，配置现代 CSS 变量、毛玻璃卡片、微动画以及明暗自适应主题。

**Tech Stack:** 原生 HTML5, 现代 CSS3 (Flexbox/Grid), 纯 JavaScript (ES6+, 零依赖)。

---

### Task 1: 题库数据源转换 (JSON to JS)

**Files:**
- Create: `tools/convert-db.js`
- Create: `data/questions-db.js`
- Verify: `node tools/convert-db.js`

- [ ] **Step 1: 创建题库转换脚本**
  新建 `tools/convert-db.js`，读取并转换 `data/questions.json` 的内容，输出为挂载在全局 `window.QUIZ_QUESTIONS` 上的 JS 文件。

  ```javascript
  const fs = require('fs');
  const path = require('path');

  const jsonPath = path.join(__dirname, '../data/questions.json');
  const jsPath = path.join(__dirname, '../data/questions-db.js');

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  // 校验JSON格式
  JSON.parse(rawData);

  const jsContent = `// 移动应用开发题库自动生成的JS数据源\nwindow.QUIZ_QUESTIONS = ${rawData.trim()};\n`;
  fs.writeFileSync(jsPath, jsContent, 'utf8');
  console.log('数据源转换成功：data/questions-db.js');
  ```

- [ ] **Step 2: 运行转换脚本**
  在终端中运行：
  `node tools/convert-db.js`
  预期输出：`数据源转换成功：data/questions-db.js`

- [ ] **Step 3: 检查生成的数据源**
  确认 `data/questions-db.js` 的开头为 `window.QUIZ_QUESTIONS = [`，结尾为 `];`。

- [ ] **Step 4: 提交代码**
  ```bash
  git add tools/convert-db.js data/questions-db.js
  git commit -m "feat: convert questions.json to questions-db.js"
  ```

---

### Task 2: 核心计算逻辑重构 (移除 ES Modules)

**Files:**
- Modify: `src/quiz-core.js`
- Create: `tools/test-core.js`

- [ ] **Step 1: 编写核心逻辑测试脚本**
  新建 `tools/test-core.js`，引入重构后的全局 `QuizCore`（在 Node 环境下通过简单模拟 window/global 挂载）来验证其所有导出方法的正确性。

  ```javascript
  const fs = require('fs');
  const path = require('path');

  // 模拟全局环境
  global.window = global;
  require('../src/quiz-core.js');

  const core = global.window.QuizCore;

  // 测试用例
  try {
    // 1. normalizeAnswer 测试
    const a1 = core.normalizeAnswer([' a ', 'B', 'a']);
    if (JSON.stringify(a1) !== JSON.stringify(['A', 'B'])) {
      throw new Error('normalizeAnswer 失败: ' + JSON.stringify(a1));
    }

    // 2. isAnswerCorrect 测试
    if (!core.isAnswerCorrect(['A', 'B'], ['b', 'a'])) {
      throw new Error('isAnswerCorrect 失败');
    }

    // 3. scoreExam 测试
    const questions = [
      { id: '1', answer: ['A'] },
      { id: '2', answer: ['B', 'C'] }
    ];
    const answers = {
      '1': ['A'],
      '2': ['B'] // 错题
    };
    const score = core.scoreExam(questions, answers);
    if (score.correct !== 1 || score.percent !== 50 || score.wrongIds[0] !== '2') {
      throw new Error('scoreExam 失败: ' + JSON.stringify(score));
    }

    console.log('✅ quiz-core.js 所有单元测试通过！');
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    process.exit(1);
  }
  ```

- [ ] **Step 2: 运行测试脚本确保其失败（TDD 验证）**
  运行：`node tools/test-core.js`
  预期结果：报错，因为 `quiz-core.js` 目前使用 `export`，在 Node 下会报 SyntaxError 或者因为 `QuizCore` 未定义而失败。

- [ ] **Step 3: 重构 `src/quiz-core.js`**
  移除所有 `export` 关键字，并将所有核心 API 挂载至 `window.QuizCore` 上。

  ```javascript
  (function () {
    function normalizeAnswer(answer) {
      return [...new Set(answer.map((item) => String(item).trim().toUpperCase()).filter(Boolean))].sort();
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

    // 挂载至全局
    window.QuizCore = {
      normalizeAnswer,
      isAnswerCorrect,
      scoreExam,
      shuffleQuestions,
      createSessionQuestions
    };
  })();
  ```

- [ ] **Step 4: 重新运行测试脚本验证通过**
  运行：`node tools/test-core.js`
  预期结果：输出 `✅ quiz-core.js 所有单元测试通过！`

- [ ] **Step 5: 提交代码**
  ```bash
  git add src/quiz-core.js tools/test-core.js
  git commit -m "refactor: remove ES Modules from quiz-core.js and export globally"
  ```

---

### Task 3: 首页与答题界面骨架重构 (`index.html`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 重构 HTML 结构**
  修改 `index.html`，引入三个普通的 JS 脚本，并划分为“首页仪表盘”与“答题工作区”两个容器。

  ```html
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>移动应用开发题库</title>
      <link rel="stylesheet" href="./styles.css">
      <!-- 同步顺序加载，彻底免除 file:// 协议下的跨域报错 -->
      <script src="./data/questions-db.js"></script>
      <script src="./src/quiz-core.js"></script>
      <script src="./app.js"></script>
    </head>
    <body>
      <!-- 头部：标题与主题切换 -->
      <header class="app-header">
        <div class="header-logo">
          <h1>移动应用开发题库</h1>
          <p id="appSummary">加载中...</p>
        </div>
        <button id="themeToggleButton" class="theme-toggle-btn" type="button" aria-label="切换主题">
          <span class="theme-icon">🌙</span>
        </button>
      </header>

      <!-- 首页仪表盘容器 -->
      <div id="dashboardView" class="view-container">
        <!-- 统计面板 -->
        <section class="stats-row">
          <div class="stats-card total-stats">
            <h3>题库总览</h3>
            <p id="statsTotalCount">-- 题</p>
            <span class="stats-desc">包含单选、多选与判断题</span>
          </div>
          <div id="wrongCardButton" class="stats-card wrong-stats clickable">
            <h3>错题本</h3>
            <p id="statsWrongCount">0 题</p>
            <span class="stats-desc">答错的题会自动记录在此</span>
          </div>
          <div class="stats-card record-stats">
            <h3>备考状态</h3>
            <p id="statsExamRecord">未开始</p>
            <span class="stats-desc">最近一次测验记录</span>
          </div>
        </section>

        <!-- 快捷操作区 -->
        <section class="quick-actions-section">
          <h2>测验与抽题</h2>
          <div class="action-buttons-group">
            <button id="quickRandomBtn" class="action-btn random-btn" type="button">
              <span class="btn-icon">🎲</span> 随机抽题
            </button>
            <button id="quickExamBtn" class="action-btn exam-btn" type="button">
              <span class="btn-icon">⏱️</span> 限时测验
            </button>
          </div>
        </section>

        <!-- 题库单元列表 -->
        <section class="sets-section">
          <h2>分套单元测试</h2>
          <div id="unitGrid" class="unit-grid"></div>
        </section>
      </div>

      <!-- 答题/测验工作区容器 -->
      <div id="quizView" class="view-container" hidden>
        <div class="app-layout">
          <!-- 侧边栏/答题卡区 -->
          <aside class="sidebar">
            <button id="backToHomeBtn" class="secondary-button back-home-btn" type="button">
              ← 返回首页
            </button>
            
            <!-- 考试倒计时 -->
            <div id="examTimerPanel" class="timer-panel" hidden>
              <div class="timer-title">剩余时间</div>
              <div id="examTimerDisplay" class="timer-display">00:00</div>
            </div>

            <!-- 统计和进度 -->
            <div class="quiz-info-panel">
              <h3 id="quizProgressTitle">当前进度</h3>
              <p id="quizProgressText">-- / --</p>
              <p id="quizCorrectRateText">正确率: --</p>
            </div>

            <!-- 答题卡 -->
            <div class="answer-card-panel">
              <h3>答题卡</h3>
              <div id="answerCard" class="answer-card"></div>
            </div>

            <button id="submitExamButton" class="primary-button submit-exam-btn" type="button" hidden>
              交卷并查看分数
            </button>
          </aside>

          <!-- 核心做题面板 -->
          <main class="quiz-panel">
            <div class="question-meta" id="questionMeta"></div>
            <h2 id="questionText" class="question-text">加载中...</h2>
            <div id="optionsList" class="options-list"></div>
            
            <!-- 解析面板 -->
            <section id="feedbackPanel" class="feedback-panel" hidden></section>
            
            <div class="quiz-actions">
              <button id="prevButton" type="button">上一题</button>
              <button id="removeWrongButton" class="remove-wrong-btn" type="button" hidden>移出错题</button>
              <button id="nextButton" type="button">下一题</button>
            </div>
          </main>
        </div>
      </div>

      <!-- 测验配置选项对话框 -->
      <div id="configModal" class="modal-dialog" hidden>
        <div class="modal-card">
          <h2 id="configModalTitle">配置测验参数</h2>
          <div class="config-form-item">
            <label for="configQuestionSize">题量设定：</label>
            <select id="configQuestionSize">
              <option value="10">10 题</option>
              <option value="20" selected>20 题</option>
              <option value="40">40 题</option>
            </select>
          </div>
          <div id="configTimeFormItem" class="config-form-item" hidden>
            <label for="configTimeLimit">限时长度：</label>
            <select id="configTimeLimit">
              <option value="15">15 分钟</option>
              <option value="30" selected>30 分钟</option>
              <option value="45">45 分钟</option>
            </select>
          </div>
          <div class="modal-actions">
            <button id="cancelConfigBtn" class="secondary-button" type="button">取消</button>
            <button id="startQuizBtn" class="primary-button" type="button">开始作答</button>
          </div>
        </div>
      </div>

      <!-- 考试结果结算弹窗 -->
      <section id="resultDialog" class="result-dialog" hidden>
        <div class="result-card">
          <button id="closeResultBtn" class="close-result" type="button" aria-label="关闭">×</button>
          <h2>测验分析报告</h2>
          <div class="result-score-block">
            <div class="score-circle">
              <span id="resultScore">0</span>
              <span class="score-label">分</span>
            </div>
            <p id="resultFeedbackText">答对 -- 题，答错 -- 题</p>
          </div>
          <h3>错题分析</h3>
          <ol id="wrongList" class="wrong-list"></ol>
        </div>
      </section>
    </body>
  </html>
  ```

- [ ] **Step 2: 提交代码**
  ```bash
  git add index.html
  git commit -m "feat: restructure index.html with dashboard and quiz workspace skeleton"
  ```

---

### Task 4: 现代高颜值样式系统 (`styles.css`)

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: 编写重构后的 CSS 样式**
  重新设计 `styles.css`，加入优雅的主题变量、毛玻璃（backdrop-filter）、顺滑动画过渡、明/暗色模式配置。

  ```css
  /* 主题与系统变量 */
  :root {
    --font-main: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif;
    
    /* 浅色主题变量 */
    --bg-app: #f4f6f9;
    --bg-card: #ffffff;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --primary-soft: #eff6ff;
    
    --success: #10b981;
    --success-soft: #ecfdf5;
    --error: #ef4444;
    --error-soft: #fef2f2;
    
    --warning: #f97316;
    --warning-soft: #fff7ed;
    
    --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
    --hover-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    
    --radius: 12px;
    --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 深色主题覆盖 */
  [data-theme="dark"] {
    --bg-app: #0f172a;
    --bg-card: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --border-color: #334155;
    
    --primary: #3b82f6;
    --primary-hover: #60a5fa;
    --primary-soft: #172554;
    
    --success: #34d399;
    --success-soft: #064e3b;
    --error: #f87171;
    --error-soft: #451a03;
    
    --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.2);
    --hover-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: var(--bg-app);
    color: var(--text-primary);
    font-family: var(--font-main);
    transition: background-color 0.3s, color 0.3s;
    line-height: 1.5;
  }

  button {
    font-family: inherit;
    transition: var(--transition);
  }

  [hidden] {
    display: none !important;
  }

  /* 顶部导航 */
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--card-shadow);
  }

  .header-logo h1 {
    font-size: 20px;
    font-weight: 700;
  }

  .header-logo p {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .theme-toggle-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 18px;
  }

  .theme-toggle-btn:hover {
    background-color: var(--primary-soft);
    border-color: var(--primary);
  }

  /* 容器视图 */
  .view-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* 首页统计面板 */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }

  .stats-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--card-shadow);
    transition: var(--transition);
  }

  .stats-card h3 {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .stats-card p {
    font-size: 32px;
    font-weight: 800;
    margin: 8px 0;
  }

  .stats-desc {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .clickable {
    cursor: pointer;
  }

  .clickable:hover {
    transform: translateY(-4px);
    box-shadow: var(--hover-shadow);
    border-color: var(--primary);
  }

  .wrong-stats {
    background: linear-gradient(135deg, var(--warning-soft), var(--bg-card));
    border-color: rgba(249, 115, 22, 0.2);
  }

  .wrong-stats:hover {
    border-color: var(--warning);
  }

  /* 快捷操作区 */
  .quick-actions-section {
    margin-bottom: 28px;
  }

  .quick-actions-section h2,
  .sets-section h2 {
    font-size: 18px;
    margin-bottom: 14px;
    font-weight: 700;
  }

  .action-buttons-group {
    display: flex;
    gap: 16px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    box-shadow: var(--card-shadow);
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--hover-shadow);
  }

  .random-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
    background-color: var(--primary-soft);
  }

  .exam-btn:hover {
    border-color: var(--warning);
    color: var(--warning);
    background-color: var(--warning-soft);
  }

  /* 单元列表网格 */
  .unit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .unit-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--card-shadow);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 160px;
    transition: var(--transition);
  }

  .unit-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--hover-shadow);
    border-color: var(--primary);
  }

  .unit-card-title {
    font-size: 16px;
    font-weight: 700;
  }

  .unit-card-count {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .unit-progress-container {
    margin: 16px 0;
  }

  .progress-bar-bg {
    background-color: var(--border-color);
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    background-color: var(--primary);
    height: 100%;
    width: 0%;
    border-radius: 3px;
    transition: width 0.4s ease-out;
  }

  .unit-progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .unit-card-btn {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    cursor: pointer;
  }

  .unit-card:hover .unit-card-btn {
    background-color: var(--primary);
    color: #ffffff;
    border-color: var(--primary);
  }

  /* 答题界面布局 */
  .app-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
    align-items: start;
  }

  .sidebar {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--card-shadow);
  }

  .back-home-btn {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 16px;
  }

  .back-home-btn:hover {
    background-color: var(--primary-soft);
    color: var(--primary);
    border-color: var(--primary);
  }

  .timer-panel {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    background-color: var(--primary-soft);
    color: var(--primary);
    margin-bottom: 16px;
  }

  .timer-title {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
  }

  .timer-display {
    font-size: 24px;
    font-weight: 800;
  }

  .timer-panel.warning-time {
    background-color: var(--error-soft);
    color: var(--error);
    border-color: var(--error);
    animation: pulse 1s infinite alternate;
  }

  @keyframes pulse {
    from { transform: scale(1); }
    to { transform: scale(1.02); }
  }

  .quiz-info-panel {
    border-top: 1px solid var(--border-color);
    padding-top: 14px;
    margin-bottom: 16px;
  }

  .quiz-info-panel h3 {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .quiz-info-panel p {
    font-size: 15px;
    font-weight: 600;
  }

  .answer-card-panel {
    border-top: 1px solid var(--border-color);
    padding-top: 14px;
    margin-bottom: 16px;
  }

  .answer-card-panel h3 {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }

  .answer-card {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    max-height: 250px;
    overflow-y: auto;
  }

  .answer-card button {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-app);
    color: var(--text-primary);
    padding: 6px 0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .answer-card button.is-answered {
    background-color: var(--primary-soft);
    color: var(--primary);
    border-color: var(--primary);
  }

  .answer-card button.is-current {
    box-shadow: 0 0 0 2px var(--text-primary);
  }

  /* 练习模式答题卡答案颜色反馈 */
  .answer-card button.practice-correct {
    background-color: var(--success);
    color: #ffffff;
    border-color: var(--success);
  }

  .answer-card button.practice-wrong {
    background-color: var(--error);
    color: #ffffff;
    border-color: var(--error);
  }

  .submit-exam-btn {
    width: 100%;
    padding: 12px;
    background-color: var(--primary);
    color: #ffffff;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .submit-exam-btn:hover {
    background-color: var(--primary-hover);
  }

  /* 做题主面板 */
  .quiz-panel {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--card-shadow);
  }

  .question-meta {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .question-text {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }

  .option-button {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background-color: var(--bg-card);
    color: var(--text-primary);
    padding: 14px 16px;
    text-align: left;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    box-shadow: var(--card-shadow);
  }

  .option-button:hover:not(:disabled) {
    transform: translateX(4px);
    border-color: var(--primary);
    box-shadow: var(--hover-shadow);
  }

  .option-button.is-selected {
    background-color: var(--primary-soft);
    border-color: var(--primary);
    font-weight: 600;
  }

  .option-button.is-correct {
    background-color: var(--success-soft);
    border-color: var(--success);
    color: var(--success);
    font-weight: 600;
  }

  .option-button.is-wrong {
    background-color: var(--error-soft);
    border-color: var(--error);
    color: var(--error);
    font-weight: 600;
  }

  /* 解析面板 */
  .feedback-panel {
    background-color: var(--bg-app);
    border-left: 4px solid var(--border-color);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 16px;
    margin-bottom: 24px;
    animation: slideDown 0.25s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .feedback-panel h4 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .feedback-panel.is-correct {
    border-left-color: var(--success);
  }

  .feedback-panel.is-correct h4 {
    color: var(--success);
  }

  .feedback-panel.is-wrong {
    border-left-color: var(--error);
  }

  .feedback-panel.is-wrong h4 {
    color: var(--error);
  }

  .feedback-panel p {
    font-size: 14px;
    margin-top: 6px;
  }

  /* 底部按钮 */
  .quiz-actions {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .quiz-actions button {
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    color: var(--text-primary);
    font-weight: 600;
    cursor: pointer;
  }

  .quiz-actions button:hover:not(:disabled) {
    background-color: var(--primary-soft);
    border-color: var(--primary);
  }

  .quiz-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quiz-actions .remove-wrong-btn {
    border-color: var(--warning);
    background-color: var(--warning-soft);
    color: var(--warning);
  }

  .quiz-actions .remove-wrong-btn:hover {
    background-color: var(--warning);
    color: #ffffff;
  }

  /* 模态对话框 */
  .modal-dialog {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 16px;
    animation: fadeIn 0.2s;
  }

  .modal-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    width: min(440px, 100%);
    box-shadow: var(--hover-shadow);
  }

  .modal-card h2 {
    font-size: 18px;
    margin-bottom: 16px;
  }

  .config-form-item {
    margin-bottom: 16px;
  }

  .config-form-item label {
    display: block;
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .config-form-item select {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-card);
    color: var(--text-primary);
    font-size: 14px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .modal-actions button {
    flex: 1;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    cursor: pointer;
    font-weight: 600;
  }

  .modal-actions .secondary-button {
    background-color: var(--bg-card);
    color: var(--text-primary);
  }

  .modal-actions .primary-button {
    background-color: var(--primary);
    color: #ffffff;
    border: none;
  }

  /* 考试结算弹窗 */
  .result-dialog {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 16px;
  }

  .result-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    width: min(640px, 100%);
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--hover-shadow);
    position: relative;
  }

  .close-result {
    position: absolute;
    top: 16px;
    right: 16px;
    border: none;
    background: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .result-card h2 {
    font-size: 20px;
    margin-bottom: 20px;
  }

  .result-score-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 20px;
  }

  .score-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 6px solid var(--primary);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 32px;
    font-weight: 800;
    color: var(--primary);
    margin-bottom: 10px;
  }

  .score-label {
    font-size: 14px;
    font-weight: 500;
    margin-left: 2px;
  }

  #resultFeedbackText {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .result-card h3 {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .wrong-list {
    list-style-position: inside;
  }

  .wrong-list li {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    line-height: 1.5;
  }

  .wrong-list li strong {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .wrong-list li p {
    margin-top: 4px;
  }

  /* 响应式调整 */
  @media (max-width: 768px) {
    .app-layout {
      grid-template-columns: 1fr;
    }
    
    .action-buttons-group {
      flex-direction: column;
    }
  }
  ```

- [ ] **Step 2: 提交代码**
  ```bash
  git add styles.css
  git commit -m "feat: complete modern styling system in styles.css with responsive transitions"
  ```

---

### Task 5: 核心应用逻辑重构 (`app.js`)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 编写重构后的应用程序状态与核心生命周期函数**
  重写整个 `app.js`，挂载全局做题状态，彻底移除对 `fetch()` 的异步加载，换为对 `window.QUIZ_QUESTIONS` 变量的直接调用。实现倒计时、主页和答题工作区切换、进度追踪保存等。

  ```javascript
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
      if (lastScore) {
        state.lastScoreText = lastScore;
      }
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

    function updateAppSummary() {
      const modeText = state.mode === "practice" 
        ? (state.scope.type === "wrong" ? "错题模式" : (state.scope.type === "all" ? "全部随机练习" : `单元测试: ${state.scope.setName}`))
        : `限时考试模式 (${state.session.length}题)`;
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
      elements.statsExamRecord.textContent = state.lastScoreText || "未开始";

      // 提取所有单元名称
      const sets = [...new Set(state.questions.map((q) => q.set))];
      
      elements.unitGrid.innerHTML = sets.map((setName) => {
        const totalInSet = state.questions.filter((q) => q.set === setName).length;
        const answeredList = state.progress[setName] || [];
        // 取并集，确保ID存在于该单元中
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

      elements.questionMeta.textContent = `${question.set} · 第 ${state.currentIndex + 1} / ${state.session.length} 题 · ${typeLabels[question.type]}`;
      elements.questionText.textContent = question.question;

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

      elements.prevButton.disabled = state.currentIndex === 0;
      elements.nextButton.disabled = state.currentIndex >= state.session.length - 1;
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
        let correctCount = 0;
        Object.keys(state.checkedById).forEach((qId) => {
          const q = state.session.find(item => item.id === qId);
          if (q && window.QuizCore.isAnswerCorrect(state.answersById[qId] || [], q.answer)) {
            correctCount++;
          }
        });
        const percent = Math.round((correctCount / answeredCount) * 100);
        elements.quizCorrectRateText.textContent = `正确率: ${percent}% (对 ${correctCount} 错 ${answeredCount - correctCount})`;
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
        limit: state.mode === "exam" || state.scope.type === "all" ? state.examConfig.limit : null,
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
        state.checkedById[question.id] = true;
        // 自动计入错题本
        const isCorrect = window.QuizCore.isAnswerCorrect(state.answersById[question.id], question.answer);
        if (!isCorrect) {
          state.wrongIds.add(question.id);
          saveWrongIds();
        }
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
            <p style="color: var(--success)">正确答案：${escapeHtml(answerText(q))}</p>
            <p style="color: var(--text-secondary)">解析：${escapeHtml(q.explanation || "暂无解析")}</p>
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
        showView("dashboard");
      });

      elements.optionsList.addEventListener("click", (event) => {
        const btn = event.target.closest(".option-button");
        const question = getCurrentQuestion();
        if (btn && question) {
          selectAnswer(question, btn.dataset.option);
        }
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
          <div style="padding: 40px; text-align: center; color: red;">
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
  ```

- [ ] **Step 2: 提交代码**
  ```bash
  git add app.js
  git commit -m "feat: rewrite app.js to integrate dashboard layout, storage, and timed exams"
  ```

---

## Plan Execution Handoff
本重构计划已经编写并保存至 `docs/superpowers/plans/2026-07-05-mobile-quiz-web-refactor.md`。

请选择您的执行模式：
1. **Subagent-Driven (推荐)** - 针对每个具体 Task 派遣子代理（Subagent），在 Task 之间进行微调审核，适合高精度细化执行。
2. **Inline Execution** - 直接在此会话中批量执行计划中的各步骤，效率更高，每步有检查点。
