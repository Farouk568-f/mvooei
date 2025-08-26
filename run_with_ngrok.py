import requests
from bs4 import BeautifulSoup
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify
from googletrans import Translator

app = Flask(__name__)

TMDB_API_KEY = "b5450f6cb1a755224209fcbf746c08f9"

# 🟢 روابط صفحات ويكيبيديا لكل قناة
CHANNEL_URLS = {
    "spacetoon": "https://en.wikipedia.org/wiki/List_of_programs_broadcast_by_Spacetoon",
    "cartoonnetwork": "https://en.wikipedia.org/wiki/List_of_programs_broadcast_by_Cartoon_Network",
    "mbc3": "https://en.wikipedia.org/wiki/List_of_programs_broadcast_by_MBC_3"
}

def scrape_channel(channel):
    """يسحب قائمة البرامج من صفحة ويكيبيديا لقناة معينة"""
    if channel not in CHANNEL_URLS:
        return []

    res = requests.get(CHANNEL_URLS[channel])
    soup = BeautifulSoup(res.text, "html.parser")
    shows = []

    # 🟢 البحث في عناوين programming فقط
    for header in soup.find_all(["h2", "h3"]):
        if "programming" in header.get_text().lower():
            ul = header.find_next("ul")
            while ul and ul.name == "ul":
                for li in ul.find_all("li", recursive=False):
                    raw_title = li.get_text(strip=True)
                    if raw_title and not raw_title.startswith("["):
                        clean_title = re.sub(r"\(.*?\)", "", raw_title).strip()
                        clean_title = re.sub(r"\s+", " ", clean_title)

                        # 🚫 تجاهل العناوين الغريبة (حرف واحد أو أرقام فقط)
                        if len(clean_title) <= 2 or clean_title.lower() in ["0–9", "0-9"]:
                            continue

                        shows.append(clean_title)
                ul = ul.find_next_sibling()
                if not ul or ul.name != "ul":
                    break

    # 🔄 إزالة التكرارات
    return list(dict.fromkeys(shows))


def search_tmdb(title):
    """يبحث عن المسلسل/الفيلم في TMDb ويرجع أول ID"""
    search_url = f"https://api.themoviedb.org/3/search/tv"
    params = {"api_key": TMDB_API_KEY, "query": title}
    try:
        res = requests.get(search_url, params=params, timeout=8).json()
        if res.get("results"):
            return {"title": title, "tmdb_id": res["results"][0]["id"], "type": "tv"}

        # نجرب كـ Movie
        movie_url = "https://api.themoviedb.org/3/search/movie"
        res = requests.get(movie_url, params={"api_key": TMDB_API_KEY, "query": title}, timeout=8).json()
        if res.get("results"):
            return {"title": title, "tmdb_id": res["results"][0]["id"], "type": "movie"}
    except:
        return {"title": title, "tmdb_id": None, "type": None}

    return {"title": title, "tmdb_id": None, "type": None}


@app.route("/api", methods=["GET"])
def get_channel():
    # 🟢 اختيار القناة
    channel = request.args.get("channel", "spacetoon").lower()
    limit = int(request.args.get("limit", 50))
    max_workers = int(request.args.get("workers", 20))

    shows = scrape_channel(channel)
    if not shows:
        return jsonify({"error": "قناة غير مدعومة", "available": list(CHANNEL_URLS.keys())})

    results = []
    seen_ids = set()  # 🚫 فلترة التكرارات حسب TMDB ID

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(search_tmdb, show) for show in shows[:limit]]
        for future in as_completed(futures):
            result = future.result()
            if result["tmdb_id"] not in seen_ids:
                results.append(result)
                seen_ids.add(result["tmdb_id"])

    return jsonify({
        "channel": channel,
        "count": len(results),
        "results": results
    })

# 🟢 New translation endpoint
@app.route("/api/translate-srt", methods=["POST"])
def translate_srt_endpoint():
    data = request.get_json()
    if not data or "srt" not in data:
        return jsonify({"error": "Missing 'srt' field in request body"}), 400

    srt_content = data["srt"]
    
    try:
        translator = Translator()
        
        # Split SRT into blocks to translate text only, preserving timestamps and numbers
        subtitle_blocks = re.split(r'\n\n', srt_content.strip())
        translated_blocks = []

        for block in subtitle_blocks:
            if not block.strip():
                continue
            
            lines = block.split('\n')
            # A valid block has at least a number, a timestamp, and one line of text
            if len(lines) >= 3:
                number = lines[0]
                timestamp = lines[1]
                text_to_translate = "\n".join(lines[2:])
                
                translated_text = translator.translate(text_to_translate, dest="ar").text
                
                translated_blocks.append(f"{number}\n{timestamp}\n{translated_text}")
            else:
                translated_blocks.append(block)

        translated_srt = "\n\n".join(translated_blocks)
        
        return jsonify({"translated_srt": translated_srt})

    except Exception as e:
        print(f"Translation error: {e}")
        return jsonify({"error": "An error occurred during translation"}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)