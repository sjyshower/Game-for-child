import csv
import json
import os
import urllib.request
from collections import Counter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHEET_RAW_PATH = os.path.join(BASE_DIR, 'sheet_raw.csv')
PARSED_JSON_PATH = os.path.join(BASE_DIR, 'parsed_chinese.json')
QUESTIONS_JS_PATH = os.path.join(BASE_DIR, 'questions_data.js')

# Download latest live sheet from Google Sheets if possible
SHEET_URL = 'https://docs.google.com/spreadsheets/d/1QetCLW6afDNxsJCB8oD6IvYQc-ReItlkLn4lFSaSVYY/export?format=csv&gid=0'
try:
    print("Connecting to Google Sheets to download latest 國文 sheet...")
    req = urllib.request.Request(SHEET_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        content = resp.read().decode('utf-8', errors='ignore')
        with open(SHEET_RAW_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
    print("Successfully downloaded latest sheet to sheet_raw.csv!")
except Exception as e:
    print(f"Notice: Failed to fetch live sheet ({e}), using local sheet_raw.csv")

def parse_grade_text(raw_text, default_grade=2):
    if not raw_text:
        return default_grade, [default_grade]
    text = str(raw_text).strip()
    mapping = [
        (1, ['一', '1', '低']),
        (2, ['二', '2', '低']),
        (3, ['三', '3', '中']),
        (4, ['四', '4', '中']),
        (5, ['五', '5', '高']),
        (6, ['六', '6', '高'])
    ]
    matched = []
    for num, patterns in mapping:
        if any(p in text for p in patterns):
            if num not in matched:
                matched.append(num)
    if not matched:
        try:
            num = int(text)
            if 1 <= num <= 6:
                matched = [num]
        except ValueError:
            pass
    if not matched:
        matched = [default_grade]
    return matched[0], matched

questions = []

with open(SHEET_RAW_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.reader(f)
    rows = list(reader)

if not rows:
    print("Error: sheet_raw.csv is empty!")
    exit(1)

header = [h.strip() for h in rows[0]]
print(f"Header columns ({len(header)}): {header}")

col_grade = -1
col_enable = -1
col_q = -1
col_speak = -1
col_ans = -1
col_w1 = -1
col_w2 = -1
col_note = -1

for idx, h in enumerate(header):
    if '年級' in h or 'grade' in h.lower():
        col_grade = idx
    elif '啟用' in h:
        col_enable = idx
    elif '題目' in h or '問題' in h:
        col_q = idx
    elif '朗讀' in h or '語音' in h:
        col_speak = idx
    elif '正確' in h or '答案' in h:
        col_ans = idx
    elif '1' in h or '錯字1' in h:
        col_w1 = idx
    elif '2' in h or '錯字2' in h:
        col_w2 = idx
    elif '備註' in h or '來源' in h:
        col_note = idx

# Fallback index offsets if header text wasn't found
if col_enable == -1: col_enable = 1 if col_grade == 0 else 0
if col_q == -1: col_q = 2 if col_grade == 0 else 1
if col_speak == -1: col_speak = 3 if col_grade == 0 else 2
if col_ans == -1: col_ans = 4 if col_grade == 0 else 3
if col_w1 == -1: col_w1 = 5 if col_grade == 0 else 4
if col_w2 == -1: col_w2 = 6 if col_grade == 0 else 5
if col_note == -1: col_note = 7 if col_grade == 0 else 6

print(f"Column Mapping -> Grade: {col_grade}, Enable: {col_enable}, Q: {col_q}, Speak: {col_speak}, Ans: {col_ans}, W1: {col_w1}, W2: {col_w2}, Note: {col_note}")

for r_idx, row in enumerate(rows[1:], start=2):
    if not row or len(row) < 4:
        continue
    
    enable = row[col_enable].strip().upper() if col_enable < len(row) else ''
    if enable != 'Y':
        continue
    
    q_text = row[col_q].strip() if col_q < len(row) else ''
    ans = row[col_ans].strip() if col_ans < len(row) else ''
    if not q_text or not ans:
        continue
    
    speak_text = row[col_speak].strip() if col_speak < len(row) else q_text
    w1 = row[col_w1].strip() if col_w1 < len(row) else '？'
    w2 = row[col_w2].strip() if col_w2 < len(row) else '？'
    note = row[col_note].strip() if col_note < len(row) else ''
    
    raw_grade = row[col_grade].strip() if (col_grade != -1 and col_grade < len(row)) else ''
    if raw_grade:
        primary_grade, all_grades = parse_grade_text(raw_grade, default_grade=2)
    elif note:
        primary_grade, all_grades = parse_grade_text(note, default_grade=2)
    else:
        primary_grade, all_grades = 2, [2]
    
    questions.append({
        "grade": primary_grade,
        "grades": all_grades,
        "rawGrade": raw_grade,
        "subject": "國文",
        "subjectKey": "chinese",
        "subBadge": note if note else "國文注音字形",
        "question": q_text,
        "speakText": speak_text if speak_text else q_text,
        "options": [ans, w1, w2],
        "answer": 0,
        "explanation": f"正確答案是「{ans}」！{f'(來源：{note})' if note else ''}",
        "speechLang": "zh-TW"
    })

print(f"Parsed {len(questions)} questions from {SHEET_RAW_PATH}!")

grade_counts = Counter(q['grade'] for q in questions)
print("Grade counts:", dict(grade_counts))

with open(PARSED_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)
print(f"Saved to {PARSED_JSON_PATH} successfully!")

js_content = "window.EXTENDED_CHINESE_BANK = " + json.dumps(questions, ensure_ascii=False, indent=1) + ";\n"
with open(QUESTIONS_JS_PATH, 'w', encoding='utf-8') as f:
    f.write(js_content)
print(f"Saved to {QUESTIONS_JS_PATH} successfully!")
