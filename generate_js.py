import json

with open(r'c:\Users\charlesh\OneDrive - Qsquare\Antigravity\parsed_chinese.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Assign appropriate grades across the 432 questions based on lesson notes:
# Lessons:
# 第一課 ~ 第三課 -> Grades 1, 2, 3
# 第四課 ~ 第六課 -> Grades 2, 3, 4
# 閱讀一 / 深層辨析 -> Grades 3, 4, 5, 6
for idx, item in enumerate(data):
    note = item.get('subBadge', '')
    if '第一課' in note:
        item['grade'] = 1 if (idx % 2 == 0) else 2
    elif '第二課' in note:
        item['grade'] = 2
    elif '第三課' in note:
        item['grade'] = 2 if (idx % 2 == 0) else 3
    elif '第四課' in note:
        item['grade'] = 3
    elif '第五課' in note:
        item['grade'] = 3 if (idx % 2 == 0) else 4
    elif '第六課' in note:
        item['grade'] = 4 if (idx % 2 == 0) else 5
    elif '閱讀' in note:
        item['grade'] = 5 if (idx % 2 == 0) else 6
    else:
        item['grade'] = 2

# Output as JS
js_content = "window.EXTENDED_CHINESE_BANK = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"

with open(r'c:\Users\charlesh\OneDrive - Qsquare\Antigravity\questions_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Exported {len(data)} Chinese questions to questions_data.js!")
