import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARSED_JSON_PATH = os.path.join(BASE_DIR, 'parsed_chinese.json')
QUESTIONS_JS_PATH = os.path.join(BASE_DIR, 'questions_data.js')

with open(PARSED_JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Output as JS
js_content = "window.EXTENDED_CHINESE_BANK = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"

with open(QUESTIONS_JS_PATH, 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Exported {len(data)} Chinese questions to {QUESTIONS_JS_PATH}!")
