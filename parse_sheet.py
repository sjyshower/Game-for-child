import csv
import json

questions = []

with open(r'c:\Users\charlesh\OneDrive - Qsquare\Antigravity\sheet_raw.csv', 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.reader(f)
    for row in reader:
        if not row or len(row) < 7:
            continue
        enable = row[0].strip()
        subject = row[1].strip()
        if enable == 'Y' and subject == '國文':
            q_text = row[2].strip()
            speak_text = row[3].strip()
            ans = row[4].strip()
            w1 = row[5].strip()
            w2 = row[6].strip()
            note = row[7].strip() if len(row) > 7 else ''

            if q_text and ans:
                # Deduce grade from note or context:
                # e.g., 第一課 ~ 第六課, 閱讀一. These are Taiwan elementary school lessons (usually Grade 2 or 3 Chinese textbook!)
                # Let's assign grade 2 (and allow grade 1-3 selection or match all selected grades)
                questions.append({
                    "grade": 2, # Grade 2 primary, but can also be tested in 1~6
                    "subject": "國文",
                    "subjectKey": "chinese",
                    "subBadge": note if note else "國文注音字形",
                    "question": q_text,
                    "speakText": speak_text,
                    "options": [ans, w1, w2],
                    "answer": 0,
                    "explanation": f"正確答案是「{ans}」！(來源：{note})",
                    "speechLang": "zh-TW"
                })

print(f"Parsed {len(questions)} questions from Google Sheet!")

with open(r'c:\Users\charlesh\OneDrive - Qsquare\Antigravity\parsed_chinese.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)
print("Saved to parsed_chinese.json successfully!")
