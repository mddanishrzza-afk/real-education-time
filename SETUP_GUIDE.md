# 🎓 REAL EDUCATION TIME — Setup Guide (बिल्कुल आसान हिंदी में)

यह गाइड उन लोगों के लिए है जिन्हें तकनीकी जानकारी कम है। हर कदम आसान भाषा में समझाया गया है।

---

## भाग 1: Firebase सेटअप (बिना यह सबसे पहले नहीं होगा)

Firebase = आपके ऐप के लिए "मुफ्त सर्वर" जो login और data store करता है। Google की सेवा है।

### चरण 1 — Google Account से लॉगिन करें
1. ब्राउज़र में खोलें: **https://console.firebase.google.com**
2. अपने Google/Gmail account से लॉगिन करें।

### चरण 2 — नया Project बनाएं
1. **"Add project" / "Create project"** (नीला बटन) पर क्लिक करें।
2. Project का नाम लिखें: `realeducationtime` (या कुछ भी)।
3. **Continue** दबाएं।
4. Google Analytics का सवाल आए — **हाँ/Yes** चुनें और Continue करें।
5. **Create project** दबाएं। 1-2 मिनट लग सकते हैं। पूरा होने पर **Continue** दबाएं।

### चरण 3 — Web App जोड़ें (यह सबसे जरूरी है)
1. Project खुलने के बाद, होम स्क्रीन पर **"</> (Web)"** आइकन पर क्लिक करें।
2. App का नाम लिखें (जैसे `realeducationtime-web`)।
3. **"Also set up Firebase Hosting"** वाला बॉक्स **नहीं** भरें (skip करें)।
4. **Register app** दबाएं।
5. अब आपको एक **नंबरों/अक्षरों वाला छोटा सा कोड (config)** दिखेगा — जैसे:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. **सबसे जरूरी:** इन सब VALUES को copy कर लें और एक कॉपी अपने पास रखें (NotePad में paste कर लें)।
7. **Continue to console** दबाएं।

### चरण 4 — Authentication (Login) चालू करें
1. बाईं तरफ मेनू से **Build → Authentication** पर क्लिक करें।
2. **Get started** दबाएं।
3. **Sign-in method** टैब में जाएं।
4. **Email/Password** पर क्लिक करें और **Enable** करें, फिर **Save**।

### चरण 5 — Database (Firestore) चालू करें
1. बाईं तरफ **Build → Firestore Database** पर क्लिक करें।
2. **Create database** दबाएं।
3. Location चुनें (भारत के पास: `asia-south1`) → **Next**।
4. Mode: **Production mode** चुनें → **Create**।
5. Rules वाले बॉक्स में हमारे `firestore.rules` की सामग्री paste करें (नीचे चरण 6 देखें) → **Publish**।

### चरण 6 — Security Rules लगाएं (जरूरी)
1. Firestore → **Rules** टैब में जाएं।
2. पुरानी सामग्री हटाकर अपने प्रोजेक्ट की **firestore.rules** फाइल की सामग्री paste करें।
3. **Publish** दबाएं।

---

## भाग 2: इस Config को अपने प्रोजेक्ट में लगाएं

### चरण 7 — .env फाइल बनाएं
1. अपने प्रोजेक्ट में `.env.example` नाम की फाइल है।
2. उसकी **copy** बनाकर उसका नाम `.env` रखें।
3. `.env` फाइल में वो 6 VALUES (चरण 3 से) paste करें:
   ```env
   VITE_FIREBASE_API_KEY=AIza... (जो मिला)
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. सेव करें। अब app असली Firebase से जुड़ जाएगा!

### चरण 8 — पहला Admin Account बनाएं
1. ऐप चलाकर **Register** से एक सामान्य account बनाएं।
2. Firebase Console → Firestore Database → `users` collection खोलें।
3. अपना बनाया हुआ user खोलें और `role` की value `student` से बदलकर `admin` करें → **Save**।
4. अब उस account से login करें → `/admin` खुलेगा।

---

## भाग 3: Play Store के लिए (Capacitor — वेब ऐप को Android ऐप बनाना)

### चरण 9 — Android app package के लिए तैयारी
Play Store के लिए निम्नलिखित करेंगे (मैं कोड तैयार कर दूँगा):
1. **Capacitor** ऐड करना (यह वेब ऐप को Android ऐप बना देता है)।
2. **Android Studio** में प्रोजेक्ट खोलना।
3. Google Play Console में **Developer account** ($25 one-time) बनाना।
4. App की details, screenshot, description भरना और **upload** करना।

> इसमें मैं आपका पूरा साथ दूँगा। पहले Firebase set करें, फिर Capacitor जोड़ेंगे।

---

## सबसे महत्वपूर्ण सलाह
- हर VALUE को ध्यान से copy करें।
- `.env` फाइल कभी किसी से शेयर न करें।
- Google Firebase की मुफ्त परतें शुरुआत के लिए काफी हैं।
- किसी भी स्टेप पर अटक जाएँ तो मुझे बताएं — मैं हर स्टेप फिर से समझाऊँगा।
