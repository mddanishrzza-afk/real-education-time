import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCurriculumCatalog } from "./curriculum-catalog";

const prisma = new PrismaClient();

type QuestionSeed = {
  publicId: string;
  topic: string;
  concept: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  stemEn: string;
  stemHi: string;
  explanationEn: string;
  explanationHi: string;
  estimatedSeconds: number;
  options: [string, string, string, boolean][];
};

const questions: QuestionSeed[] = [
  {
    publicId: "RET-C9-MATH-NS-001",
    topic: "rational-numbers",
    concept: "number-properties",
    difficulty: "EASY" as const,
    stemEn: "Which of the following is a rational number?",
    stemHi: "निम्नलिखित में से कौन-सी एक परिमेय संख्या है?",
    explanationEn: "A rational number can be written as p/q where p and q are integers and q is not zero. 3/7 already has this form.",
    explanationHi: "परिमेय संख्या को p/q के रूप में लिखा जा सकता है, जहाँ p और q पूर्णांक हैं और q शून्य नहीं है। 3/7 इसी रूप में है।",
    estimatedSeconds: 40,
    options: [
      ["A", "√2", "√2", false],
      ["B", "π", "π", false],
      ["C", "3/7", "3/7", true],
      ["D", "√5", "√5", false],
    ],
  },
  {
    publicId: "RET-C9-MATH-NS-002",
    topic: "rational-numbers",
    concept: "number-properties",
    difficulty: "MEDIUM" as const,
    stemEn: "The decimal expansion of 13/125 is:",
    stemHi: "13/125 का दशमलव विस्तार है:",
    explanationEn: "Multiply numerator and denominator by 8: 13/125 = 104/1000 = 0.104.",
    explanationHi: "अंश और हर को 8 से गुणा करें: 13/125 = 104/1000 = 0.104।",
    estimatedSeconds: 55,
    options: [
      ["A", "0.104", "0.104", true],
      ["B", "0.014", "0.014", false],
      ["C", "1.04", "1.04", false],
      ["D", "0.13", "0.13", false],
    ],
  },
  {
    publicId: "RET-C9-MATH-NS-003",
    topic: "rational-numbers",
    concept: "number-properties",
    difficulty: "HARD" as const,
    stemEn: "Which statement about the number 0.101001000100001… is correct?",
    stemHi: "संख्या 0.101001000100001… के बारे में कौन-सा कथन सही है?",
    explanationEn: "The decimal neither terminates nor repeats in a fixed block, so it is irrational.",
    explanationHi: "यह दशमलव न तो समाप्त होता है और न ही किसी निश्चित खंड में दोहराता है, इसलिए यह अपरिमेय है।",
    estimatedSeconds: 70,
    options: [
      ["A", "It is a terminating rational number", "यह सांत परिमेय संख्या है", false],
      ["B", "It is a recurring rational number", "यह आवर्ती परिमेय संख्या है", false],
      ["C", "It is an irrational number", "यह अपरिमेय संख्या है", true],
      ["D", "It is an integer", "यह पूर्णांक है", false],
    ],
  },
  {
    publicId: "RET-C9-MATH-POLY-001",
    topic: "polynomials",
    concept: "polynomial-zeroes",
    difficulty: "EASY" as const,
    stemEn: "What is the degree of the polynomial 4x³ − 2x + 7?",
    stemHi: "बहुपद 4x³ − 2x + 7 की घात क्या है?",
    explanationEn: "The highest power of x with a non-zero coefficient is 3, so the degree is 3.",
    explanationHi: "x की सबसे बड़ी घात 3 है जिसका गुणांक शून्य नहीं है, इसलिए बहुपद की घात 3 है।",
    estimatedSeconds: 35,
    options: [
      ["A", "1", "1", false],
      ["B", "2", "2", false],
      ["C", "3", "3", true],
      ["D", "4", "4", false],
    ],
  },
  {
    publicId: "RET-C9-MATH-POLY-002",
    topic: "polynomials",
    concept: "polynomial-zeroes",
    difficulty: "MEDIUM" as const,
    stemEn: "If p(x) = x² − 5x + 6, which pair gives its zeroes?",
    stemHi: "यदि p(x) = x² − 5x + 6 है, तो इसके शून्यकों का युग्म कौन-सा है?",
    explanationEn: "Factor p(x): x² − 5x + 6 = (x − 2)(x − 3). Therefore the zeroes are 2 and 3.",
    explanationHi: "गुणनखंड करें: x² − 5x + 6 = (x − 2)(x − 3)। इसलिए शून्यक 2 और 3 हैं।",
    estimatedSeconds: 75,
    options: [
      ["A", "−2 and −3", "−2 और −3", false],
      ["B", "2 and 3", "2 और 3", true],
      ["C", "1 and 6", "1 और 6", false],
      ["D", "−1 and −6", "−1 और −6", false],
    ],
  },
  {
    publicId: "RET-C9-SCI-MOTION-001",
    topic: "motion",
    concept: "speed-velocity",
    difficulty: "EASY" as const,
    stemEn: "A car travels 120 km in 3 hours. Its average speed is:",
    stemHi: "एक कार 3 घंटे में 120 किमी चलती है। उसकी औसत चाल है:",
    explanationEn: "Average speed = total distance ÷ total time = 120 ÷ 3 = 40 km/h.",
    explanationHi: "औसत चाल = कुल दूरी ÷ कुल समय = 120 ÷ 3 = 40 किमी/घंटा।",
    estimatedSeconds: 45,
    options: [
      ["A", "30 km/h", "30 किमी/घंटा", false],
      ["B", "40 km/h", "40 किमी/घंटा", true],
      ["C", "60 km/h", "60 किमी/घंटा", false],
      ["D", "360 km/h", "360 किमी/घंटा", false],
    ],
  },
  {
    publicId: "RET-C9-SCI-MOTION-002",
    topic: "motion",
    concept: "speed-velocity",
    difficulty: "MEDIUM" as const,
    stemEn: "The slope of a distance–time graph represents:",
    stemHi: "दूरी–समय ग्राफ की ढाल किसे दर्शाती है?",
    explanationEn: "Slope is change in distance divided by change in time, which is speed.",
    explanationHi: "ढाल दूरी में परिवर्तन को समय में परिवर्तन से भाग देने पर मिलती है, जो चाल है।",
    estimatedSeconds: 45,
    options: [
      ["A", "Acceleration", "त्वरण", false],
      ["B", "Force", "बल", false],
      ["C", "Speed", "चाल", true],
      ["D", "Momentum", "संवेग", false],
    ],
  },
  {
    publicId: "RET-C9-SCI-FORCE-001",
    topic: "laws-of-motion",
    concept: "newtons-laws",
    difficulty: "EASY" as const,
    stemEn: "Newton’s second law relates force to:",
    stemHi: "न्यूटन का दूसरा नियम बल को किससे जोड़ता है?",
    explanationEn: "Newton’s second law states that force equals the rate of change of momentum; for constant mass, F = ma.",
    explanationHi: "न्यूटन के दूसरे नियम के अनुसार बल संवेग परिवर्तन की दर है; स्थिर द्रव्यमान के लिए F = ma।",
    estimatedSeconds: 50,
    options: [
      ["A", "Mass and acceleration", "द्रव्यमान और त्वरण", true],
      ["B", "Only distance", "केवल दूरी", false],
      ["C", "Only time", "केवल समय", false],
      ["D", "Volume and density", "आयतन और घनत्व", false],
    ],
  },
  {
    publicId: "RET-C9-SCI-FORCE-002",
    topic: "laws-of-motion",
    concept: "newtons-laws",
    difficulty: "MEDIUM" as const,
    stemEn: "A 5 kg object accelerates at 2 m/s². The net force is:",
    stemHi: "5 किग्रा की वस्तु में 2 मी/से² का त्वरण है। परिणामी बल है:",
    explanationEn: "Using F = ma, force = 5 × 2 = 10 N.",
    explanationHi: "F = ma से, बल = 5 × 2 = 10 N।",
    estimatedSeconds: 55,
    options: [
      ["A", "2.5 N", "2.5 N", false],
      ["B", "7 N", "7 N", false],
      ["C", "10 N", "10 N", true],
      ["D", "25 N", "25 N", false],
    ],
  },
  {
    publicId: "RET-C9-SCI-ENERGY-001",
    topic: "work-energy",
    concept: "kinetic-energy",
    difficulty: "MEDIUM" as const,
    stemEn: "If the speed of an object is doubled, its kinetic energy becomes:",
    stemHi: "यदि किसी वस्तु की चाल दोगुनी कर दी जाए, तो उसकी गतिज ऊर्जा हो जाती है:",
    explanationEn: "Kinetic energy is ½mv². Doubling v makes v² four times as large, so kinetic energy becomes four times.",
    explanationHi: "गतिज ऊर्जा ½mv² है। v को दोगुना करने पर v² चार गुना हो जाता है, इसलिए गतिज ऊर्जा चार गुनी होती है।",
    estimatedSeconds: 65,
    options: [
      ["A", "Half", "आधी", false],
      ["B", "Double", "दोगुनी", false],
      ["C", "Four times", "चार गुनी", true],
      ["D", "Unchanged", "अपरिवर्तित", false],
    ],
  },
];

async function upsertQuestion(
  data: (typeof questions)[number],
  topicMap: Record<string, string>,
  conceptMap: Record<string, string>,
) {
  const question = await prisma.question.upsert({
    where: { publicId: data.publicId },
    update: {
      topicId: topicMap[data.topic],
      conceptId: conceptMap[data.concept],
      type: "MCQ",
      difficulty: data.difficulty,
      status: "PUBLISHED",
      stemEn: data.stemEn,
      stemHi: data.stemHi,
      explanationEn: data.explanationEn,
      explanationHi: data.explanationHi,
      estimatedSeconds: data.estimatedSeconds,
      sourceName: "Real Education Time Editorial",
      sourceReference: "Class 9 foundation set v1",
      syllabusVersion: "2026-foundation-v1",
    },
    create: {
      publicId: data.publicId,
      topicId: topicMap[data.topic],
      conceptId: conceptMap[data.concept],
      type: "MCQ",
      difficulty: data.difficulty,
      status: "PUBLISHED",
      stemEn: data.stemEn,
      stemHi: data.stemHi,
      explanationEn: data.explanationEn,
      explanationHi: data.explanationHi,
      estimatedSeconds: data.estimatedSeconds,
      sourceName: "Real Education Time Editorial",
      sourceReference: "Class 9 foundation set v1",
      syllabusVersion: "2026-foundation-v1",
    },
  });
  await prisma.questionOption.deleteMany({ where: { questionId: question.id } });
  await prisma.questionOption.createMany({
    data: data.options.map(([label, textEn, textHi, isCorrect], index) => ({
      questionId: question.id,
      label,
      textEn,
      textHi,
      isCorrect,
      sequence: index + 1,
    })),
  });
  return question;
}

async function main() {
  const includeDemo = process.env.SEED_DEMO_DATA === "true";
  const [cbse, bseb, icse] = await Promise.all([
    prisma.board.upsert({ where: { code: "CBSE" }, update: {}, create: { code: "CBSE", nameEn: "CBSE", nameHi: "सीबीएसई" } }),
    prisma.board.upsert({ where: { code: "BSEB" }, update: {}, create: { code: "BSEB", nameEn: "Bihar Board", nameHi: "बिहार बोर्ड" } }),
    prisma.board.upsert({ where: { code: "ICSE" }, update: {}, create: { code: "ICSE", nameEn: "ICSE", nameHi: "आईसीएसई" } }),
  ]);

  const classRows = await Promise.all(
    [6, 7, 8, 9, 10, 11, 12].map((level) =>
      prisma.academicClass.upsert({
        where: { code: `CLASS_${level}` },
        update: {},
        create: { code: `CLASS_${level}`, nameEn: `Class ${level}`, nameHi: `कक्षा ${level}`, levelOrder: level },
      }),
    ),
  );
  const class9 = classRows.find((row) => row.levelOrder === 9)!;

  const curriculum = await seedCurriculumCatalog(prisma, cbse, classRows);

  await prisma.accessPlan.upsert({
    where: { code: "SCHOOL_6_12_FULL" },
    update: {
      category: "SCHOOL_6_12",
      titleEn: "Class 6–12 Full Access",
      titleHi: "कक्षा 6–12 पूर्ण एक्सेस",
      descriptionEn: "One-time access to the complete Class 6–12 school category.",
      descriptionHi: "कक्षा 6–12 स्कूल श्रेणी के लिए एक बार का पूर्ण एक्सेस।",
      amountPaise: 700,
      currency: "INR",
      isActive: true,
      sortOrder: 1,
    },
    create: {
      code: "SCHOOL_6_12_FULL",
      category: "SCHOOL_6_12",
      titleEn: "Class 6–12 Full Access",
      titleHi: "कक्षा 6–12 पूर्ण एक्सेस",
      descriptionEn: "One-time access to the complete Class 6–12 school category.",
      descriptionHi: "कक्षा 6–12 स्कूल श्रेणी के लिए एक बार का पूर्ण एक्सेस।",
      amountPaise: 700,
      currency: "INR",
      sortOrder: 1,
    },
  });
  await prisma.accessPlan.upsert({
    where: { code: "BOARD_COMPETITIVE_FULL" },
    update: {
      category: "BOARD_COMPETITIVE",
      titleEn: "Board & Competitive Full Access",
      titleHi: "बोर्ड और प्रतियोगी पूर्ण एक्सेस",
      descriptionEn: "One-time access to the Board and Competitive category as reviewed tests are published.",
      descriptionHi: "प्रकाशित और समीक्षित बोर्ड तथा प्रतियोगी सामग्री के लिए एक बार का एक्सेस।",
      amountPaise: 900,
      currency: "INR",
      isActive: true,
      sortOrder: 2,
    },
    create: {
      code: "BOARD_COMPETITIVE_FULL",
      category: "BOARD_COMPETITIVE",
      titleEn: "Board & Competitive Full Access",
      titleHi: "बोर्ड और प्रतियोगी पूर्ण एक्सेस",
      descriptionEn: "One-time access to the Board and Competitive category as reviewed tests are published.",
      descriptionHi: "प्रकाशित और समीक्षित बोर्ड तथा प्रतियोगी सामग्री के लिए एक बार का एक्सेस।",
      amountPaise: 900,
      currency: "INR",
      sortOrder: 2,
    },
  });

  const [math, science, english] = await Promise.all([
    prisma.subject.upsert({ where: { code: "MATHEMATICS" }, update: {}, create: { code: "MATHEMATICS", nameEn: "Mathematics", nameHi: "गणित", icon: "calculator", color: "indigo" } }),
    prisma.subject.upsert({ where: { code: "SCIENCE" }, update: {}, create: { code: "SCIENCE", nameEn: "Science", nameHi: "विज्ञान", icon: "flask", color: "emerald" } }),
    prisma.subject.upsert({ where: { code: "ENGLISH" }, update: {}, create: { code: "ENGLISH", nameEn: "English", nameHi: "अंग्रेज़ी", icon: "book", color: "amber" } }),
  ]);

  const mathOffering = await prisma.classOffering.upsert({
    where: { boardId_classId_subjectId: { boardId: cbse.id, classId: class9.id, subjectId: math.id } },
    update: { syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
    create: { boardId: cbse.id, classId: class9.id, subjectId: math.id, syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
  });
  const scienceOffering = await prisma.classOffering.upsert({
    where: { boardId_classId_subjectId: { boardId: cbse.id, classId: class9.id, subjectId: science.id } },
    update: { syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
    create: { boardId: cbse.id, classId: class9.id, subjectId: science.id, syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
  });
  await prisma.classOffering.upsert({
    where: { boardId_classId_subjectId: { boardId: cbse.id, classId: class9.id, subjectId: english.id } },
    update: { syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
    create: { boardId: cbse.id, classId: class9.id, subjectId: english.id, syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
  });

  const numbersChapter = await prisma.chapter.upsert({
    where: { offeringId_code: { offeringId: mathOffering.id, code: "NUMBER_SYSTEMS" } },
    update: {},
    create: { offeringId: mathOffering.id, code: "NUMBER_SYSTEMS", titleEn: "Number Systems", titleHi: "संख्या पद्धति", sequence: 1 },
  });
  const polynomialChapter = await prisma.chapter.upsert({
    where: { offeringId_code: { offeringId: mathOffering.id, code: "POLYNOMIALS" } },
    update: {},
    create: { offeringId: mathOffering.id, code: "POLYNOMIALS", titleEn: "Polynomials", titleHi: "बहुपद", sequence: 2 },
  });
  const motionChapter = await prisma.chapter.upsert({
    where: { offeringId_code: { offeringId: scienceOffering.id, code: "MOTION_FORCE" } },
    update: {},
    create: { offeringId: scienceOffering.id, code: "MOTION_FORCE", titleEn: "Motion, Force & Energy", titleHi: "गति, बल और ऊर्जा", sequence: 1 },
  });

  const rational = await prisma.topic.upsert({
    where: { chapterId_code: { chapterId: numbersChapter.id, code: "RATIONAL_NUMBERS" } },
    update: {},
    create: { chapterId: numbersChapter.id, code: "RATIONAL_NUMBERS", titleEn: "Rational & Irrational Numbers", titleHi: "परिमेय और अपरिमेय संख्याएँ", sequence: 1 },
  });
  const polynomials = await prisma.topic.upsert({
    where: { chapterId_code: { chapterId: polynomialChapter.id, code: "POLYNOMIALS_BASICS" } },
    update: {},
    create: { chapterId: polynomialChapter.id, code: "POLYNOMIALS_BASICS", titleEn: "Polynomial Basics", titleHi: "बहुपद की मूल बातें", sequence: 1 },
  });
  const motion = await prisma.topic.upsert({
    where: { chapterId_code: { chapterId: motionChapter.id, code: "MOTION" } },
    update: {},
    create: { chapterId: motionChapter.id, code: "MOTION", titleEn: "Motion", titleHi: "गति", sequence: 1 },
  });
  const laws = await prisma.topic.upsert({
    where: { chapterId_code: { chapterId: motionChapter.id, code: "LAWS_OF_MOTION" } },
    update: {},
    create: { chapterId: motionChapter.id, code: "LAWS_OF_MOTION", titleEn: "Laws of Motion", titleHi: "गति के नियम", sequence: 2 },
  });
  const energy = await prisma.topic.upsert({
    where: { chapterId_code: { chapterId: motionChapter.id, code: "WORK_ENERGY" } },
    update: {},
    create: { chapterId: motionChapter.id, code: "WORK_ENERGY", titleEn: "Work & Energy", titleHi: "कार्य और ऊर्जा", sequence: 3 },
  });

  const numberPropertiesContent = {
    contentEn: "A rational number can be written as p/q, where p and q are integers and q is not zero. Its decimal expansion either terminates or repeats in a fixed pattern. An irrational number cannot be written in that form; its decimal is non-terminating and non-repeating. Example: 3/8 = 0.375 is rational, while √2 is irrational.",
    contentHi: "परिमेय संख्या को p/q के रूप में लिखा जा सकता है, जहाँ p और q पूर्णांक हैं तथा q शून्य नहीं है। इसका दशमलव विस्तार या तो समाप्त होता है या एक निश्चित क्रम में दोहराता है। अपरिमेय संख्या का दशमलव अनंत और अनावर्ती होता है। उदाहरण: 3/8 = 0.375 परिमेय है, जबकि √2 अपरिमेय है।",
  };
  const numberProperties = await prisma.concept.upsert({
    where: { topicId_code: { topicId: rational.id, code: "NUMBER_PROPERTIES" } }, update: { status: "PUBLISHED", ...numberPropertiesContent },
    create: { topicId: rational.id, code: "NUMBER_PROPERTIES", titleEn: "Properties of Numbers", titleHi: "संख्याओं के गुण", sequence: 1, status: "PUBLISHED", ...numberPropertiesContent },
  });
  const polynomialContent = {
    contentEn: "A polynomial is an expression made from variables and non-negative integer powers. Its degree is the highest power with a non-zero coefficient. A zero of p(x) is a value a for which p(a) = 0. For p(x) = x² − 5x + 6, factorization gives (x − 2)(x − 3), so the zeroes are 2 and 3.",
    contentHi: "बहुपद चर और उनकी गैर-ऋणात्मक पूर्णांक घातों से बना व्यंजक है। उसकी घात, शून्येतर गुणांक वाली सबसे बड़ी घात होती है। p(x) का शून्यक वह मान a है जिसके लिए p(a) = 0 हो। x² − 5x + 6 = (x − 2)(x − 3), इसलिए इसके शून्यक 2 और 3 हैं।",
  };
  const polynomialZeroes = await prisma.concept.upsert({
    where: { topicId_code: { topicId: polynomials.id, code: "POLYNOMIAL_ZEROES" } }, update: { status: "PUBLISHED", ...polynomialContent },
    create: { topicId: polynomials.id, code: "POLYNOMIAL_ZEROES", titleEn: "Degree & Zeroes", titleHi: "घात और शून्यक", sequence: 1, status: "PUBLISHED", ...polynomialContent },
  });
  const speedContent = {
    contentEn: "Speed tells how fast distance changes: average speed = total distance ÷ total time. Velocity is speed with direction and is based on displacement. Speed is a scalar; velocity is a vector. The slope of a distance–time graph gives speed, while the slope of a displacement–time graph gives velocity.",
    contentHi: "चाल बताती है कि दूरी कितनी तेजी से बदलती है: औसत चाल = कुल दूरी ÷ कुल समय। वेग दिशा सहित चाल है और विस्थापन पर आधारित होता है। चाल अदिश है, जबकि वेग सदिश है। दूरी–समय ग्राफ की ढाल चाल और विस्थापन–समय ग्राफ की ढाल वेग देती है।",
  };
  const speedVelocity = await prisma.concept.upsert({
    where: { topicId_code: { topicId: motion.id, code: "SPEED_VELOCITY" } }, update: { status: "PUBLISHED", ...speedContent },
    create: { topicId: motion.id, code: "SPEED_VELOCITY", titleEn: "Speed and Velocity", titleHi: "चाल और वेग", sequence: 1, status: "PUBLISHED", ...speedContent },
  });
  const newtonContent = {
    contentEn: "Newton's first law describes inertia: motion does not change unless an unbalanced external force acts. The second law links net force, mass and acceleration: F = ma for constant mass. The third law says forces occur in equal and opposite pairs acting on different bodies. Example: a 5 kg object accelerated at 2 m/s² needs a net force of 10 N.",
    contentHi: "न्यूटन का पहला नियम जड़त्व समझाता है: असंतुलित बाहरी बल के बिना गति की अवस्था नहीं बदलती। दूसरा नियम परिणामी बल, द्रव्यमान और त्वरण को जोड़ता है: स्थिर द्रव्यमान के लिए F = ma। तीसरे नियम में बल बराबर और विपरीत जोड़ों में अलग-अलग वस्तुओं पर लगते हैं। उदाहरण: 5 kg वस्तु में 2 m/s² त्वरण के लिए 10 N बल चाहिए।",
  };
  const newtonsLaws = await prisma.concept.upsert({
    where: { topicId_code: { topicId: laws.id, code: "NEWTONS_LAWS" } }, update: { status: "PUBLISHED", ...newtonContent },
    create: { topicId: laws.id, code: "NEWTONS_LAWS", titleEn: "Newton's Laws", titleHi: "न्यूटन के नियम", sequence: 1, status: "PUBLISHED", ...newtonContent },
  });
  const energyContent = {
    contentEn: "Work is done when a force causes displacement in its direction: W = Fs for a constant parallel force. Kinetic energy is the energy of motion: KE = ½mv². Because speed is squared, doubling speed makes kinetic energy four times as large when mass stays constant. The work–energy theorem states that net work equals the change in kinetic energy.",
    contentHi: "जब बल अपनी दिशा में विस्थापन कराता है तो कार्य होता है: स्थिर समानांतर बल के लिए W = Fs। गतिज ऊर्जा गति की ऊर्जा है: KE = ½mv²। चाल का वर्ग होने के कारण, द्रव्यमान स्थिर रखते हुए चाल दोगुनी करने पर गतिज ऊर्जा चार गुनी हो जाती है। कार्य–ऊर्जा प्रमेय के अनुसार परिणामी कार्य गतिज ऊर्जा में परिवर्तन के बराबर होता है।",
  };
  const kineticEnergy = await prisma.concept.upsert({
    where: { topicId_code: { topicId: energy.id, code: "KINETIC_ENERGY" } }, update: { status: "PUBLISHED", ...energyContent },
    create: { topicId: energy.id, code: "KINETIC_ENERGY", titleEn: "Kinetic Energy", titleHi: "गतिज ऊर्जा", sequence: 1, status: "PUBLISHED", ...energyContent },
  });

  const topicMap = {
    "rational-numbers": rational.id,
    polynomials: polynomials.id,
    motion: motion.id,
    "laws-of-motion": laws.id,
    "work-energy": energy.id,
  };
  const conceptMap = {
    "number-properties": numberProperties.id,
    "polynomial-zeroes": polynomialZeroes.id,
    "speed-velocity": speedVelocity.id,
    "newtons-laws": newtonsLaws.id,
    "kinetic-energy": kineticEnergy.id,
  };

  const questionRows = [];
  for (const question of questions) questionRows.push(await upsertQuestion(question, topicMap, conceptMap));

  const diagnostic = await prisma.test.upsert({
    where: { slug: "class-9-foundation-diagnostic" },
    update: { status: "PUBLISHED", totalMarks: 10, durationMinutes: 12 },
    create: {
      slug: "class-9-foundation-diagnostic",
      titleEn: "Class 9 Foundation Diagnostic",
      titleHi: "कक्षा 9 फाउंडेशन डायग्नोस्टिक",
      descriptionEn: "A balanced Mathematics and Science check to discover your current strengths and learning gaps.",
      descriptionHi: "आपकी मौजूदा मजबूतियों और सीखने की कमियों को पहचानने के लिए गणित और विज्ञान की संतुलित जाँच।",
      mode: "DIAGNOSTIC",
      durationMinutes: 12,
      totalMarks: 10,
      negativeMarking: false,
      allowPause: false,
      instructionsEn: "Choose one answer for each question. Unanswered questions receive zero marks.",
      instructionsHi: "हर प्रश्न के लिए एक उत्तर चुनें। बिना उत्तर वाले प्रश्न पर शून्य अंक मिलेंगे।",
      status: "PUBLISHED",
    },
  });
  await prisma.testQuestion.deleteMany({ where: { testId: diagnostic.id } });
  await prisma.testQuestion.createMany({
    data: questionRows.map((question, index) => ({ testId: diagnostic.id, questionId: question.id, sequence: index + 1, marks: 1, negativeMarks: 0 })),
  });

  const mathSprint = await prisma.test.upsert({
    where: { slug: "number-systems-quick-check" },
    update: { status: "PUBLISHED", offeringId: null },
    create: {
      slug: "number-systems-quick-check",
      titleEn: "Number Systems Quick Check",
      titleHi: "संख्या पद्धति क्विक चेक",
      descriptionEn: "Five focused questions on rational numbers and polynomials.",
      descriptionHi: "परिमेय संख्याओं और बहुपदों पर पाँच केंद्रित प्रश्न।",
      mode: "PRACTICE",
      offeringId: mathOffering.id,
      durationMinutes: 7,
      totalMarks: 5,
      negativeMarking: false,
      status: "PUBLISHED",
    },
  });
  await prisma.testQuestion.deleteMany({ where: { testId: mathSprint.id } });
  await prisma.testQuestion.createMany({
    data: questionRows.slice(0, 5).map((question, index) => ({ testId: mathSprint.id, questionId: question.id, sequence: index + 1, marks: 1, negativeMarks: 0 })),
  });

  if (includeDemo) {
    const passwordHash = await bcrypt.hash("Learn@123", 12);
    const verifiedAt = new Date();
    const demoUser = await prisma.user.upsert({
    where: { email: "student@realeducationtime.com" },
    update: { name: "Aarav Kumar", passwordHash, status: "ACTIVE", preferredLanguage: "HINGLISH", emailVerifiedAt: verifiedAt, termsAcceptedAt: verifiedAt, privacyAcceptedAt: verifiedAt },
    create: { email: "student@realeducationtime.com", name: "Aarav Kumar", passwordHash, role: "STUDENT", status: "ACTIVE", preferredLanguage: "HINGLISH", emailVerifiedAt: verifiedAt, termsAcceptedAt: verifiedAt, privacyAcceptedAt: verifiedAt },
  });
  const demoProfile = await prisma.studentProfile.upsert({
    where: { userId: demoUser.id },
    update: { boardId: cbse.id, classId: class9.id, onboardingCompleted: true, currentStreak: 7, longestStreak: 12, xp: 1240, level: 4, dailyStudyMinutes: 60, preparationLevel: "INTERMEDIATE" },
    create: { userId: demoUser.id, boardId: cbse.id, classId: class9.id, onboardingCompleted: true, currentStreak: 7, longestStreak: 12, xp: 1240, level: 4, dailyStudyMinutes: 60, preparationLevel: "INTERMEDIATE" },
  });

  const now = new Date();
  const historical = [
    { id: "seed-attempt-1", days: 24, score: 5, accuracy: 62.5, correct: 5, incorrect: 3, skipped: 2, duration: 690 },
    { id: "seed-attempt-2", days: 14, score: 6, accuracy: 66.7, correct: 6, incorrect: 3, skipped: 1, duration: 640 },
    { id: "seed-attempt-3", days: 5, score: 8, accuracy: 80, correct: 8, incorrect: 2, skipped: 0, duration: 582 },
  ];
  for (const item of historical) {
    const submittedAt = new Date(now.getTime() - item.days * 86_400_000);
    await prisma.testAttempt.upsert({
      where: { id: item.id },
      update: { score: item.score, accuracy: item.accuracy, correctCount: item.correct, incorrectCount: item.incorrect, skippedCount: item.skipped, submittedAt },
      create: {
        id: item.id,
        testId: diagnostic.id,
        studentId: demoProfile.id,
        status: "SUBMITTED",
        startedAt: new Date(submittedAt.getTime() - item.duration * 1000),
        submittedAt,
        score: item.score,
        maxScore: 10,
        accuracy: item.accuracy,
        correctCount: item.correct,
        incorrectCount: item.incorrect,
        skippedCount: item.skipped,
        durationSeconds: item.duration,
        averageResponseSeconds: item.duration / 10,
      },
    });
  }

  const masteryData = [
    [rational.id, 82, 0.86, 12, "STRONG"],
    [polynomials.id, 48, 0.68, 8, "WEAK"],
    [motion.id, 74, 0.8, 10, "NEEDS_PRACTICE"],
    [laws.id, 61, 0.72, 9, "NEEDS_PRACTICE"],
    [energy.id, 35, 0.55, 5, "WEAK"],
  ] as const;
  for (const [topicId, score, confidence, evidenceCount, band] of masteryData) {
    await prisma.masteryScore.upsert({
      where: { studentId_topicId: { studentId: demoProfile.id, topicId } },
      update: { score, confidence, evidenceCount, band },
      create: { studentId: demoProfile.id, topicId, score, confidence, evidenceCount, band, nextReviewAt: score < 60 ? now : null },
    });
  }

  await prisma.recommendation.deleteMany({ where: { studentId: demoProfile.id } });
  await prisma.recommendation.createMany({ data: [
    { studentId: demoProfile.id, topicId: energy.id, type: "REVISE", title: "Revise Work & Energy", reason: "Mastery is 35%. Start with the kinetic-energy concept, then answer 5 focused questions.", priority: 95, actionUrl: "/tests/class-9-foundation-diagnostic" },
    { studentId: demoProfile.id, topicId: polynomials.id, type: "PRACTICE", title: "Practice polynomial zeroes", reason: "Recent evidence shows application errors even though basic definitions are clear.", priority: 85, actionUrl: "/tests/number-systems-quick-check" },
  ] });
  }

  await prisma.scoringPolicy.upsert({
    where: { code_version: { code: "MASTERY", version: "mastery-v1" } },
    update: { isActive: true },
    create: {
      code: "MASTERY",
      version: "mastery-v1",
      isActive: true,
      configJson: { learningRate: 0.28, confidenceTarget: 10, difficultyWeights: { EASY: 0.85, MEDIUM: 1, HARD: 1.15 }, speedFloor: 0.7, correctThreshold: 75, weakThreshold: 50 },
    },
  });

  await prisma.achievement.upsert({ where: { code: "FIRST_TEST" }, update: {}, create: { code: "FIRST_TEST", titleEn: "First Test", titleHi: "पहला टेस्ट", descriptionEn: "Complete your first test", descriptionHi: "अपना पहला टेस्ट पूरा करें", icon: "trophy", xpReward: 50 } });
  await prisma.achievement.upsert({ where: { code: "SEVEN_DAY_STREAK" }, update: {}, create: { code: "SEVEN_DAY_STREAK", titleEn: "7 Day Streak", titleHi: "7 दिन की स्ट्रीक", descriptionEn: "Learn for seven days in a row", descriptionHi: "लगातार सात दिन सीखें", icon: "flame", xpReward: 100 } });

  console.log(`Seed complete: ${questionRows.length} reviewed questions and 2 published tests${includeDemo ? ", with demo learner" : " (production-safe content only)"}.`);
  console.log(`Curriculum map: ${curriculum.offeringCount} Class 6–12 offerings and ${curriculum.chapterCount} chapter units; unreviewed lesson shells remain DRAFT.`);
  console.log(`Boards: ${cbse.code}, ${bseb.code}, ${icse.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
