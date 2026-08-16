// ============================================================
// LOCAL Study assistant (works WITHOUT internet)
// Fallback when Gemini is unreachable (e.g. sandboxed preview).
// ============================================================

const KB = [
  {
    k: ['photosynthesis', 'प्रकाश संश्लेषण'],
    en: 'Photosynthesis is how green plants make their own food using sunlight. Plants take in carbon dioxide (CO2) and water, and with the help of chlorophyll and sunlight, they make glucose (food) and release oxygen. It happens mainly in the leaves.\n\nQuick tip: remember it as "sunlight + water + CO2 = food + oxygen".',
    hi: 'प्रकाश संश्लेषण वह प्रक्रिया है जिससे हरे पौधे सूर्य के प्रकाश की मदद से अपना भोजन बनाते हैं। पौधे कार्बन डाइऑक्साइड (CO2) और पानी लेते हैं, और क्लोरोफिल तथा सूर्य के प्रकाश की मदद से ग्लूकोज (भोजन) बनाते हैं और ऑक्सीजन छोड़ते हैं। यह मुख्यतः पत्तियों में होता है।\n\nक्विक टिप: याद रखें "सूरज की रोशनी + पानी + CO2 = भोजन + ऑक्सीजन"।',
  },
  {
    k: ['newton', 'first law', 'न्यूटन', 'inertia', 'जड़त्व'],
    en: 'Newton\u2019s First Law of Motion (Law of Inertia) says: An object stays at rest, or keeps moving in a straight line, unless an outside force acts on it. For example, when a bus stops suddenly you jerk forward because your body wants to keep moving.\n\nQuick tip: think of "a body resists change in its state of motion".',
    hi: 'न्यूटन का गति का पहला नियम (जड़त्व का नियम) कहता है: कोई वस्तु स्थिर रहती है, या सीधी रेखा में चलती रहती है, जब तक कोई बाहरी बल उस पर कार्य न करे। जब बस अचानक रुकती है तो आप आगे झुक जाते हैं क्योंकि आपका शरीर चलता रहना चाहता है।\n\nक्विक टिप: सोचें "वस्तु अपनी गति की स्थिति बदलने का विरोध करती है"।',
  },
  {
    k: ['water cycle', 'जल चक्र', 'evaporation', 'वाष्पीकरण'],
    en: 'The water cycle is the journey of water on Earth. The sun heats water in rivers, lakes and oceans, turning it into vapour (evaporation). The vapour rises, cools and forms clouds (condensation). When the clouds get heavy, water falls back as rain or snow (precipitation), and the cycle repeats.\n\nQuick tip: remember "evaporation → condensation → precipitation".',
    hi: 'जल चक्र पृथ्वी पर पानी की यात्रा है। सूर्य नदियों, झीलों और महासागरों के पानी को गर्म करके वाष्प में बदल देता है (वाष्पीकरण)। वाष्प ऊपर जाकर ठंडी होकर बादल बनाती है (संघनन)। जब बादल भारी हो जाते हैं, तो पानी बारिश या बर्फ के रूप में गिरता है (वर्षण), और चक्र दोहराता है।\n\nक्विक टिप: याद रखें "वाष्पीकरण → संघनन → वर्षण"।',
  },
  {
    k: ['cpu', 'सीपीयू', 'computer brain'],
    en: 'The CPU (Central Processing Unit) is called the brain of the computer. It performs all the calculations and processes instructions. It has parts like the ALU (does maths/logic) and the Control Unit (manages operations).\n\nQuick tip: think of the CPU as the "thinking part" of the computer.',
    hi: 'सीपीयू (Central Processing Unit) को कंप्यूटर का मस्तिष्क कहा जाता है। यह सभी गणनाएं करता है और निर्देशों को प्रोसेस करता है। इसके भाग हैं जैसे ALU (गणित/तर्क करता है) और Control Unit (संचालन प्रबंधित करता है)।\n\nक्विक टिप: सीपीयू को कंप्यूटर का "सोचने वाला हिस्सा" समझें।',
  },
  {
    k: ['solar system', 'सौरमंडल', 'planets', 'ग्रह'],
    en: 'The Solar System has the Sun at the center and eight planets that orbit it: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Mercury is closest to the Sun, and Neptune is farthest. The Earth is the only planet known to have life.\n\nQuick tip: "My Very Educated Mother Just Served Us Noodles" = Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.',
    hi: 'सौरमंडल में केंद्र में सूर्य है और आठ ग्रह उसकी परिक्रमा करते हैं: बुध, शुक्र, पृथ्वी, मंगल, बृहस्पति, शनि, अरुण और वरुण। बुध सूर्य के सबसे निकट है और वरुण सबसे दूर। पृथ्वी एकमात्र ज्ञात ग्रह है जहां जीवन है।\n\nक्विक टिप: बुध, शुक्र, पृथ्वी, मंगल, बृहस्पति, शनि, अरुण, वरुण का क्रम याद रखें।',
  },
  {
    k: ['gravity', 'गुरुत्वाकर्षण', 'गुरुत्व'],
    en: 'Gravity is a force that pulls objects toward each other. Earth\u2019s gravity pulls everything toward its center, which is why objects fall down and why we stay on the ground. The strength of gravity depends on mass and distance.\n\nQuick tip: more mass = more gravity; farther away = less gravity.',
    hi: 'गुरुत्वाकर्षण एक बल है जो वस्तुओं को एक-दूसरे की ओर खींचता है। पृथ्वी का गुरुत्वाकर्षण सब कुछ अपने केंद्र की ओर खींचता है, इसलिए वस्तुएं नीचे गिरती हैं और हम जमीन पर रहते हैं। गुरुत्व की ताकत द्रव्यमान और दूरी पर निर्भर करती है।\n\nक्विक टिप: अधिक द्रव्यमान = अधिक गुरुत्व; दूर = कम गुरुत्व।',
  },
  {
    k: ['mitochondria', 'माइटोकॉन्ड्रिया', 'powerhouse', 'पावरहाउस'],
    en: 'Mitochondria are called the powerhouse of the cell. They produce energy in the form of ATP by breaking down food (glucose). This energy powers all the cell\u2019s activities.\n\nQuick tip: "mitochondria = energy factory" of the cell.',
    hi: 'माइटोकॉन्ड्रिया को कोशिका का पावरहाउस कहा जाता है। यह भोजन (ग्लूकोज) को तोड़कर ATP के रूप में ऊर्जा बनाता है। यह ऊर्जा कोशिका की सभी गतिविधियों को शक्ति देती है।\n\nक्विक टिप: "माइटोकॉन्ड्रिया = कोशिका का ऊर्जा कारखाना"।',
  },
]

const FALLBACK_EN =
  'I\u2019m an offline tutor here, so I can answer common topics like photosynthesis, Newton\u2019s laws, the water cycle, the solar system, gravity, the CPU, and cell biology. For a full AI-powered answer, please try again once the app is online (deployed).\n\nYou can also ask me about any topic in class 6 to 12 and I will do my best to help!'
const FALLBACK_HI =
  'मैं यहां एक सरल ऑफलाइन ट्यूटर हूं, इसलिए मैं प्रकाश संश्लेषण, न्यूटन के नियम, जल चक्र, सौरमंडल, गुरुत्वाकर्षण, सीपीयू और कोशिका जीव विज्ञान जैसे सामान्य विषयों का जवाब दे सकता हूं। पूरा AI जवाब पाने के लिए, कृपया ऐप ऑनलाइन (deployed) होने के बाद फिर से कोशिश करें।\n\nआप कक्षा 6 से 12 के किसी भी विषय के बारे में पूछ सकते हैं और मैं मदद करने की कोशिश करूंगा!'

export function localStudyAnswer(question, lang = 'en') {
  const q = (question || '').toLowerCase()
  const isHi = lang === 'hi'

  let best = null
  let bestScore = 0
  for (const entry of KB) {
    for (const keyword of entry.k) {
      const kw = keyword.toLowerCase()
      if (q.includes(kw) && kw.length > bestScore) {
        bestScore = kw.length
        best = entry
      }
    }
  }

  if (best) return isHi ? best.hi : best.en
  return isHi ? FALLBACK_HI : FALLBACK_EN
}
