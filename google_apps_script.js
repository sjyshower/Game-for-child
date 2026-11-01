/**
 * ============================================================================
 * 國小知識射擊對決戰 - Google Apps Script (GAS) 題庫 Web API
 * ============================================================================
 * 
 * 本程式碼用於發布為 Google Apps Script 網路應用程式 (Web App)，
 * 能將 Google 試算表中的題目自動解析為遊戲所需的 JSON 格式。
 *
 * 【主要特點】
 * 1. 支援標準 RESTful JSON 格式 (供 fetch 使用)
 * 2. 支援 JSONP 模式 (?callback=xxx，相容本地 file:/// 執行與嚴格 CORS 環境)
 * 3. 同時支援「國文」與「英文」分頁，或單一分頁讀取
 * 4. 支援年級篩選參數 (?grade=2) 與科目參數 (?subject=chinese 或 ?subject=english)
 * 5. 自動識別欄位名稱（年級、啟用、題目、語音朗讀、答案、誘答錯字1、誘答錯字2、備註）
 * 6. 可作為試算表內建指令碼 (容器繫結)，亦可作為獨立指令碼 (透過 SPREADSHEET_ID 讀取)
 */

// 預設試算表 ID (若作為獨立 Apps Script 專案執行時使用)
var DEFAULT_SPREADSHEET_ID = "1QetCLW6afDNxsJCB8oD6IvYQc-ReItlkLn4lFSaSVYY";

/**
 * 取得 Google 試算表物件
 */
function getTargetSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // 非容器繫結專案，繼續嘗試 openById
  }
  return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
}

/**
 * HTTP GET 請求處理入口 (Web App Entrypoint)
 */
function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    
    // 參數處理
    var targetSubject = (params.subject || params.tab || 'all').toLowerCase();
    var targetGrade = params.grade ? parseInt(params.grade, 10) : null;
    var callback = params.callback;

    var resultData = {
      chinese: [],
      english: []
    };

    // 1. 讀取國文分頁
    if (targetSubject === 'all' || targetSubject === 'chinese' || targetSubject === '國文') {
      var chineseSheet = ss.getSheetByName('國文') || 
                         ss.getSheetByName('國語') || 
                         ss.getSheetByName('chinese') || 
                         ss.getSheetByName('Chinese') || 
                         ss.getSheets()[0];
      if (chineseSheet) {
        resultData.chinese = parseSheetData(chineseSheet, '國文', 'chinese', 'zh-TW', 2);
      }
    }

    // 2. 讀取英文分頁
    if (targetSubject === 'all' || targetSubject === 'english' || targetSubject === '英文') {
      var englishSheet = ss.getSheetByName('英文') || 
                         ss.getSheetByName('英語') || 
                         ss.getSheetByName('english') || 
                         ss.getSheetByName('English');
      if (englishSheet) {
        resultData.english = parseSheetData(englishSheet, '英文', 'english', 'en-US', 2);
      }
    }

    // 3. 年級篩選 (若有傳入 grade 參數)
    if (targetGrade && !isNaN(targetGrade)) {
      resultData.chinese = resultData.chinese.filter(function(q) {
        return q.grades && q.grades.indexOf(targetGrade) !== -1;
      });
      resultData.english = resultData.english.filter(function(q) {
        return q.grades && q.grades.indexOf(targetGrade) !== -1;
      });
    }

    var totalCount = resultData.chinese.length + resultData.english.length;
    var responsePayload = {
      status: 'success',
      count: totalCount,
      updatedAt: new Date().toISOString(),
      data: resultData
    };

    var jsonString = JSON.stringify(responsePayload);

    // 支援 JSONP 模式
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + jsonString + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // 標準 JSON 模式
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorPayload = {
      status: 'error',
      message: err.toString()
    };
    var errString = JSON.stringify(errorPayload);

    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + errString + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errString)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 自動識別表頭欄位索引
 */
function findColumns(headerRow) {
  var cols = {
    grade: -1,
    enable: -1,
    question: -1,
    speak: -1,
    answer: -1,
    w1: -1,
    w2: -1,
    note: -1
  };

  for (var i = 0; i < headerRow.length; i++) {
    var h = String(headerRow[i] || '').trim();
    var lower = h.toLowerCase();

    if (h.indexOf('年級') !== -1 || lower.indexOf('grade') !== -1) {
      cols.grade = i;
    } else if (h.indexOf('啟用') !== -1 || lower.indexOf('enable') !== -1) {
      cols.enable = i;
    } else if (h.indexOf('題目') !== -1 || h.indexOf('問題') !== -1 || lower.indexOf('question') !== -1) {
      cols.question = i;
    } else if (h.indexOf('朗讀') !== -1 || h.indexOf('語音') !== -1 || lower.indexOf('speak') !== -1) {
      cols.speak = i;
    } else if (h.indexOf('正確') !== -1 || h.indexOf('答案') !== -1 || lower.indexOf('answer') !== -1) {
      cols.answer = i;
    } else if (h.indexOf('1') !== -1 || h.indexOf('錯字1') !== -1) {
      cols.w1 = i;
    } else if (h.indexOf('2') !== -1 || h.indexOf('錯字2') !== -1) {
      cols.w2 = i;
    } else if (h.indexOf('備註') !== -1 || h.indexOf('來源') !== -1 || lower.indexOf('note') !== -1) {
      cols.note = i;
    }
  }

  // 若未匹配到表頭，使用預設索引容錯機制
  if (cols.enable === -1) cols.enable = (cols.grade === 0) ? 1 : 0;
  if (cols.question === -1) cols.question = (cols.grade === 0) ? 2 : 1;
  if (cols.speak === -1) cols.speak = (cols.grade === 0) ? 3 : 2;
  if (cols.answer === -1) cols.answer = (cols.grade === 0) ? 4 : 3;
  if (cols.w1 === -1) cols.w1 = (cols.grade === 0) ? 5 : 4;
  if (cols.w2 === -1) cols.w2 = (cols.grade === 0) ? 6 : 5;
  if (cols.note === -1) cols.note = (cols.grade === 0) ? 7 : 6;

  return cols;
}

/**
 * 解析年級字串 (支援：一、二、1、2、低年級、中年級、高年級等)
 */
function parseGrades(rawGrade, note, defaultGrade) {
  defaultGrade = defaultGrade || 2;
  var text = String(rawGrade || '').trim();
  var mapping = [
    { num: 1, keys: ['一', '1', '低'] },
    { num: 2, keys: ['二', '2', '低'] },
    { num: 3, keys: ['三', '3', '中'] },
    { num: 4, keys: ['四', '4', '中'] },
    { num: 5, keys: ['五', '5', '高'] },
    { num: 6, keys: ['六', '6', '高'] }
  ];

  var assigned = [];

  if (text) {
    for (var i = 0; i < mapping.length; i++) {
      var item = mapping[i];
      for (var k = 0; k < item.keys.length; k++) {
        if (text.indexOf(item.keys[k]) !== -1) {
          if (assigned.indexOf(item.num) === -1) assigned.push(item.num);
          break;
        }
      }
    }
    if (assigned.length === 0) {
      var num = parseInt(text, 10);
      if (!isNaN(num) && num >= 1 && num <= 6) assigned.push(num);
    }
  }

  // 若無直接指定年級，嘗試從備註分析
  if (assigned.length === 0 && note) {
    var noteText = String(note).trim();
    for (var j = 0; j < mapping.length; j++) {
      var item2 = mapping[j];
      for (var k2 = 0; k2 < item2.keys.length; k2++) {
        if (noteText.indexOf(item2.keys[k2]) !== -1) {
          if (assigned.indexOf(item2.num) === -1) assigned.push(item2.num);
          break;
        }
      }
    }
  }

  if (assigned.length === 0) {
    assigned.push(defaultGrade);
  }

  return {
    primary: assigned[0],
    all: assigned
  };
}

/**
 * 解析分頁資料並轉換成遊戲題庫物件
 */
function parseSheetData(sheet, subjectName, subjectKey, lang, defaultGrade) {
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var header = data[0];
  var cols = findColumns(header);
  var questions = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row || row.length < 4) continue;

    // 檢查「啟用」欄位必須為 Y
    var enable = String(row[cols.enable] || '').trim().toUpperCase();
    if (enable !== 'Y') continue;

    var qText = String(row[cols.question] || '').trim();
    var ans = String(row[cols.answer] || '').trim();
    if (!qText || !ans) continue;

    var speakText = String(row[cols.speak] || '').trim() || qText;
    var w1 = String(row[cols.w1] || '').trim() || '？';
    var w2 = String(row[cols.w2] || '').trim() || '？';
    var note = (cols.note !== -1 && row[cols.note]) ? String(row[cols.note]).trim() : '';
    var rawGrade = (cols.grade !== -1 && row[cols.grade]) ? String(row[cols.grade]).trim() : '';

    var gradeInfo = parseGrades(rawGrade, note, defaultGrade);

    questions.push({
      grade: gradeInfo.primary,
      grades: gradeInfo.all,
      rawGrade: rawGrade,
      subject: subjectName,
      subjectKey: subjectKey,
      subBadge: note || (subjectName === '國文' ? '國文注音字形' : '生活英語單字'),
      question: qText,
      speakText: speakText,
      options: [ans, w1, w2],
      answer: 0,
      explanation: '正確答案是「' + ans + '」！' + (note ? '(來源：' + note + ')' : ''),
      speechLang: lang
    });
  }

  return questions;
}

/**
 * 測試函數：可在 Apps Script 編輯器中直接點擊「執行」測試
 */
function testGasApi() {
  var mockEvent = { parameter: { subject: 'all' } };
  var result = doGet(mockEvent);
  Logger.log("=== 測試輸出 ===");
  Logger.log(result.getContent().substring(0, 1000));
}

