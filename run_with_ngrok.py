# --- ملف: run_with_ngrok.py ---
import uvicorn
from pyngrok import ngrok
import threading
import time
import sys

# 1. استيراد التطبيق
try:
    from movie_api import app
except ImportError:
    print("خطأ: لم يتم العثور على ملف 'movie_api.py' أو متغير 'app' بداخله.")
    sys.exit(1)

HOST = "0.0.0.0"  # مهم! خليها 0.0.0.0 عشان ngrok يقدر يوصل
PORT = 8000

def run_uvicorn():
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

print("🚀 بدء تشغيل خادم FastAPI في الخلفية...")
uvicorn_thread = threading.Thread(target=run_uvicorn, daemon=True)
uvicorn_thread.start()

# انتظر قليلاً ليتشغل السيرفر
time.sleep(2)

try:
    print(f"🔗 إنشاء نفق ngrok إلى http://{HOST}:{PORT}...")
    public_url = ngrok.connect(PORT, "http").public_url  # خذ فقط الرابط
    print("=" * 50)
    print("✅ تم التشغيل بنجاح!")
    print(f"🔗 الرابط العام: {public_url}")
    print("=" * 50)
    print("✨ استعمل الرابط أعلاه في HTML أو Postman.")
    print("ℹ️ Ctrl + C لإيقاف الخادم.")

    while True:
        time.sleep(1)

except Exception as e:
    print(f"❌ خطأ أثناء تشغيل ngrok: {e}")

finally:
    print("\n shutting down...")
    try:
        ngrok.disconnect(public_url)
    except:
        pass
    ngrok.kill()
