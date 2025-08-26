#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify
from flask_cors import CORS
from deep_translator import GoogleTranslator
import re
import sys
from concurrent.futures import ThreadPoolExecutor
import os

app = Flask(__name__)
CORS(app)

SRT_BLOCK_REGEX = re.compile(r'(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]+?)(?=\r?\n\r?\n|\Z)', re.MULTILINE)

def parse_srt(srt_content):
    blocks = []
    for match in SRT_BLOCK_REGEX.finditer(srt_content):
        text = match.group(3).strip()
        is_translatable = not (text.startswith('[') and text.endswith(']')) and not text.startswith('♪')
        blocks.append({
            'index': match.group(1),
            'timestamp': match.group(2),
            'text': text,
            'is_translatable': is_translatable
        })
    return blocks

def reconstruct_srt(blocks):
    return "\n\n".join([f"{b['index']}\n{b['timestamp']}\n{b['text']}" for b in blocks])

def translate_block(text, target_lang='ar'):
    translator = GoogleTranslator(source='en', target=target_lang)
    try:
        return translator.translate(text)
    except Exception as e:
        print(f"Error translating block: {e}", file=sys.stderr)
        return text  # fallback

@app.route('/translate_srt', methods=['POST'])
def translate_srt():
    try:
        data = request.get_json()
        print(f"/translate_srt called. Has JSON: {bool(data)}", flush=True)
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        srt_content = data.get('srt_content', '')
        target_lang = data.get('target_lang', 'ar')
        print(f"Incoming SRT length: {len(srt_content)} chars, target_lang={target_lang}", flush=True)

        if not srt_content:
            return jsonify({'error': 'No SRT content provided'}), 400

        blocks = parse_srt(srt_content)
        if not blocks:
            return jsonify({'error': 'Could not parse SRT content'}), 400

        translatable_blocks = [b for b in blocks if b['is_translatable']]
        texts_to_translate = [b['text'] for b in translatable_blocks]

        if not texts_to_translate:
            return jsonify({'translated_srt': srt_content})

        print(f"Found {len(texts_to_translate)} translatable text blocks.", flush=True)

        # Use ThreadPoolExecutor for parallel translation
        with ThreadPoolExecutor(max_workers=35) as executor:
            translated_texts = list(executor.map(lambda t: translate_block(t, target_lang), texts_to_translate))

        if len(translated_texts) != len(texts_to_translate):
            print(f"CRITICAL WARNING: Mismatch in line count after translation. Original: {len(texts_to_translate)}, Translated: {len(translated_texts)}", file=sys.stderr)
            return jsonify({'translated_srt': srt_content})

        # Re-insert translated text
        for block, translated in zip(translatable_blocks, translated_texts):
            block['text'] = translated.strip()

        reconstructed_content = reconstruct_srt(blocks)
        print("Translation complete.")
        
        return jsonify({'translated_srt': reconstructed_content})

    except Exception as e:
        print(f"Critical error in /translate_srt endpoint: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'An internal server error occurred'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'OK', 'message': 'Translation service is running'})

if __name__ == '__main__':
    print("Starting professional translation service with deep-translator...")
    try:
        from waitress import serve
        port = int(os.environ.get('PORT', '5001'))
        serve(app, host='0.0.0.0', port=port)
    except ImportError:
        print("Waitress not found. Running with Flask's development server (not recommended for production).")
        print("Install waitress with: pip install waitress")
        port = int(os.environ.get('PORT', '5001'))
        app.run(host='0.0.0.0', port=port, debug=False)
