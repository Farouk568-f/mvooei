#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

def test_srt_parsing():
    # نموذج SRT للاختبار
    test_srt = """1
00:00:01,000 --> 00:00:03,000
Hello, how are you?

2
00:00:03,500 --> 00:00:05,000
I'm fine, thank you.

3
00:00:06,000 --> 00:00:08,000
[Background music]

4
00:00:09,000 --> 00:00:11,000
♪ Song lyrics ♪"""

    print("Testing SRT parsing...")
    print("Original SRT:")
    print(test_srt)
    print("\n" + "="*50 + "\n")
    
    # تطبيق regex
    pattern = r'(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]+?)(?=\n\n|\n*$)'
    blocks = []
    
    for match in re.finditer(pattern, test_srt):
        index = match.group(1)
        timestamp = match.group(2)
        text = match.group(3).strip()
        
        # تحديد النصوص القابلة للترجمة
        is_translatable = not (text.startswith('[') and text.endsWith(']')) and not text.startswith('♪')
        
        blocks.append({
            'index': index,
            'timestamp': timestamp,
            'text': text,
            'is_translatable': is_translatable
        })
        
        print(f"Block {index}:")
        print(f"  Timestamp: {timestamp}")
        print(f"  Text: {text}")
        print(f"  Translatable: {is_translatable}")
        print()
    
    print(f"Total blocks found: {len(blocks)}")
    translatable_count = sum(1 for block in blocks if block['is_translatable'])
    print(f"Translatable blocks: {translatable_count}")

if __name__ == "__main__":
    test_srt_parsing()
