const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../data/questions.json');
const jsPath = path.join(__dirname, '../data/questions-db.js');

try {
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  // Validate JSON format
  JSON.parse(rawData);

  const jsContent = `// 移动应用开发题库自动生成的JS数据源\nwindow.QUIZ_QUESTIONS = ${rawData.trim()};\n`;
  fs.writeFileSync(jsPath, jsContent, 'utf8');
  console.log('数据源转换成功：data/questions-db.js');
} catch (error) {
  console.error('转换失败:', error.message);
  process.exit(1);
}
