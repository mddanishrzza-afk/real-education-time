import type { AcademicClass, Board, PrismaClient } from "@prisma/client";

type SubjectCatalog = {
  code: string;
  nameEn: string;
  nameHi: string;
  icon: string;
  color: string;
  chapters: Record<number, string[]>;
};

const languageUnits = [
  "Reading Comprehension",
  "Vocabulary in Context",
  "Grammar and Usage",
  "Creative Writing",
  "Functional Writing",
  "Literature and Critical Response",
  "Speaking and Presentation",
];
const hindiUnits = [
  "अपठित बोध",
  "शब्द भंडार और प्रयोग",
  "व्याकरण और भाषा प्रयोग",
  "रचनात्मक लेखन",
  "व्यावहारिक लेखन",
  "साहित्य बोध और समीक्षा",
  "मौखिक अभिव्यक्ति",
];
const byClasses = (classes: number[], chapters: string[]) => Object.fromEntries(classes.map((level) => [level, chapters]));

/**
 * Independently authored curriculum map. It uses broad syllabus domains rather
 * than reproducing any publisher's prose, solved examples, or question bank.
 * Draft lesson shells are intentionally not published by the seed.
 */
export const curriculumCatalog: SubjectCatalog[] = [
  {
    code: "MATHEMATICS", nameEn: "Mathematics", nameHi: "गणित", icon: "calculator", color: "indigo",
    chapters: {
      6: ["Knowing Our Numbers", "Whole Numbers", "Playing with Numbers", "Basic Geometrical Ideas", "Understanding Elementary Shapes", "Integers", "Fractions", "Decimals", "Data Handling", "Mensuration", "Algebra", "Ratio and Proportion", "Symmetry", "Practical Geometry"],
      7: ["Integers", "Fractions and Decimals", "Data Handling", "Simple Equations", "Lines and Angles", "Triangles and Their Properties", "Comparing Quantities", "Rational Numbers", "Perimeter and Area", "Algebraic Expressions", "Exponents and Powers", "Symmetry", "Visualising Solid Shapes"],
      8: ["Rational Numbers", "Linear Equations in One Variable", "Understanding Quadrilaterals", "Data Handling", "Squares and Square Roots", "Cubes and Cube Roots", "Comparing Quantities", "Algebraic Expressions and Identities", "Mensuration", "Exponents and Powers", "Direct and Inverse Proportion", "Factorisation", "Introduction to Graphs"],
      9: ["Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations in Two Variables", "Introduction to Euclid's Geometry", "Lines and Angles", "Triangles", "Quadrilaterals", "Circles", "Heron's Formula", "Surface Areas and Volumes", "Statistics"],
      10: ["Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry", "Applications of Trigonometry", "Circles", "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"],
      11: ["Sets", "Relations and Functions", "Trigonometric Functions", "Complex Numbers and Quadratic Equations", "Linear Inequalities", "Permutations and Combinations", "Binomial Theorem", "Sequences and Series", "Straight Lines", "Conic Sections", "Introduction to Three-Dimensional Geometry", "Limits and Derivatives", "Statistics", "Probability"],
      12: ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants", "Continuity and Differentiability", "Applications of Derivatives", "Integrals", "Applications of Integrals", "Differential Equations", "Vector Algebra", "Three-Dimensional Geometry", "Linear Programming", "Probability"],
    },
  },
  {
    code: "SCIENCE", nameEn: "Science", nameHi: "विज्ञान", icon: "flask", color: "emerald",
    chapters: {
      6: ["Food and Its Sources", "Components of Food", "Materials Around Us", "Separation of Substances", "Changes Around Us", "Getting to Know Plants", "Body Movements", "Living Organisms and Their Surroundings", "Motion and Measurement", "Light, Shadows and Reflections", "Electricity and Circuits", "Fun with Magnets", "Air Around Us", "Water and Conservation"],
      7: ["Nutrition in Plants", "Nutrition in Animals", "Heat", "Acids, Bases and Salts", "Physical and Chemical Changes", "Respiration in Organisms", "Transportation in Plants and Animals", "Reproduction in Plants", "Motion and Time", "Electric Current and Its Effects", "Light", "Forests and Ecosystems", "Wastewater Management"],
      8: ["Crop Production and Management", "Microorganisms", "Coal and Petroleum", "Combustion and Flame", "Conservation of Plants and Animals", "Reproduction in Animals", "Adolescence", "Force and Pressure", "Friction", "Sound", "Chemical Effects of Electric Current", "Light", "Natural Phenomena"],
      9: ["Matter in Our Surroundings", "Is Matter Around Us Pure", "Atoms and Molecules", "Structure of the Atom", "The Fundamental Unit of Life", "Tissues", "Motion", "Force and Laws of Motion", "Gravitation", "Work and Energy", "Sound", "Improvement in Food Resources"],
      10: ["Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals", "Carbon and Its Compounds", "Life Processes", "Control and Coordination", "How Organisms Reproduce", "Heredity", "Light: Reflection and Refraction", "The Human Eye and Colourful World", "Electricity", "Magnetic Effects of Electric Current", "Our Environment"],
    },
  },
  { code: "ENGLISH", nameEn: "English", nameHi: "अंग्रेज़ी", icon: "book-open", color: "amber", chapters: byClasses([6, 7, 8, 9, 10, 11, 12], languageUnits) },
  { code: "HINDI", nameEn: "Hindi", nameHi: "हिंदी", icon: "languages", color: "rose", chapters: byClasses([6, 7, 8, 9, 10, 11, 12], hindiUnits) },
  {
    code: "SOCIAL_SCIENCE", nameEn: "Social Science", nameHi: "सामाजिक विज्ञान", icon: "landmark", color: "orange",
    chapters: {
      6: ["Early Human Communities", "First Cities and States", "New Ideas and Empires", "India: Location and Physical Features", "Maps and Globes", "Major Domains of Earth", "Rural Livelihoods", "Urban Livelihoods", "Diversity and Government", "Local Government"],
      7: ["Medieval Kingdoms", "Delhi Sultanate and Mughals", "Regional Cultures", "Environment and Ecosystems", "Inside Our Earth", "Air and Water", "Markets Around Us", "State Government", "Media and Advertising", "Equality and Inclusion"],
      8: ["The Modern Period", "Colonial Rule and Resistance", "Social Reform and Nationalism", "Resources and Development", "Agriculture and Industries", "Human Resources", "The Constitution", "Parliament and Law", "Judiciary", "Social Justice"],
      9: ["The French Revolution", "Socialism and the Russian Revolution", "Nazism and the Rise of Hitler", "India: Size and Location", "Physical Features of India", "Drainage", "Climate", "Population", "Democracy and Constitutional Design", "Electoral Politics", "Working of Institutions", "Poverty and Food Security"],
      10: ["Nationalism in Europe", "Nationalism in India", "The Making of a Global World", "Resources and Development", "Forest and Wildlife", "Water Resources", "Agriculture", "Manufacturing Industries", "Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties", "Development", "Sectors of the Economy", "Money and Credit", "Globalisation"],
    },
  },
  {
    code: "COMPUTER_APPLICATIONS", nameEn: "Computer Applications", nameHi: "कंप्यूटर अनुप्रयोग", icon: "monitor", color: "cyan",
    chapters: {
      6: ["Digital Devices", "Files and Folders", "Word Processing", "Presentations", "Internet Safety", "Block-Based Coding"],
      7: ["Computer Systems", "Spreadsheets", "Digital Communication", "Cyber Safety", "Algorithms", "Programming with Blocks"],
      8: ["Networks and the Internet", "Data and Spreadsheets", "Web Page Foundations", "Digital Citizenship", "Programming Logic", "Introduction to Python"],
      9: ["Information Technology Basics", "Digital Documentation", "Electronic Spreadsheets", "Database Concepts", "Web Applications and Security", "Programming Foundations"],
      10: ["Digital Documentation Advanced", "Spreadsheets Advanced", "Database Management", "Web Applications", "Cyber Ethics", "Programming and Problem Solving"],
    },
  },
  {
    code: "PHYSICS", nameEn: "Physics", nameHi: "भौतिकी", icon: "atom", color: "blue",
    chapters: {
      11: ["Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion", "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"],
      12: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics"],
    },
  },
  {
    code: "CHEMISTRY", nameEn: "Chemistry", nameHi: "रसायन विज्ञान", icon: "flask-conical", color: "teal",
    chapters: {
      11: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity", "Chemical Bonding and Molecular Structure", "Thermodynamics", "Equilibrium", "Redox Reactions", "Organic Chemistry: Basic Principles", "Hydrocarbons"],
      12: ["Solutions", "Electrochemistry", "Chemical Kinetics", "The d- and f-Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"],
    },
  },
  {
    code: "BIOLOGY", nameEn: "Biology", nameHi: "जीवविज्ञान", icon: "leaf", color: "green",
    chapters: {
      11: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals", "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Photosynthesis", "Respiration in Plants", "Plant Growth and Development", "Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products", "Locomotion and Movement", "Neural Control", "Chemical Coordination"],
      12: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Microbes in Human Welfare", "Biotechnology: Principles and Processes", "Biotechnology and Its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation"],
    },
  },
  {
    code: "COMPUTER_SCIENCE", nameEn: "Computer Science", nameHi: "कंप्यूटर विज्ञान", icon: "code", color: "sky",
    chapters: {
      11: ["Computer Systems", "Data Representation", "Boolean Logic", "Problem Solving", "Python Fundamentals", "Data Types and Operators", "Control Flow", "Strings and Lists", "Tuples and Dictionaries", "Functions", "Society, Law and Ethics"],
      12: ["Python Revision", "Functions and Exception Handling", "File Handling", "Data Structures", "Computer Networks", "Database Concepts", "SQL", "Python-SQL Connectivity", "Cyber Safety and Ethics"],
    },
  },
  {
    code: "ACCOUNTANCY", nameEn: "Accountancy", nameHi: "लेखाशास्त्र", icon: "receipt", color: "violet",
    chapters: {
      11: ["Introduction to Accounting", "Theory Base of Accounting", "Recording Transactions", "Bank Reconciliation", "Trial Balance and Rectification", "Depreciation and Provisions", "Bills of Exchange", "Financial Statements", "Accounts from Incomplete Records", "Applications of Computers in Accounting"],
      12: ["Accounting for Partnership Firms", "Change in Profit-Sharing Ratio", "Admission of a Partner", "Retirement and Death of a Partner", "Dissolution of Partnership", "Accounting for Share Capital", "Issue of Debentures", "Financial Statement Analysis", "Accounting Ratios", "Cash Flow Statement"],
    },
  },
  {
    code: "BUSINESS_STUDIES", nameEn: "Business Studies", nameHi: "व्यवसाय अध्ययन", icon: "briefcase", color: "purple",
    chapters: {
      11: ["Business, Trade and Commerce", "Forms of Business Organisation", "Public and Global Enterprises", "Business Services", "Emerging Modes of Business", "Social Responsibility and Ethics", "Formation of a Company", "Sources of Business Finance", "Small Business and Entrepreneurship", "Internal Trade", "International Business"],
      12: ["Nature and Significance of Management", "Principles of Management", "Business Environment", "Planning", "Organising", "Staffing", "Directing", "Controlling", "Financial Management", "Financial Markets", "Marketing Management", "Consumer Protection"],
    },
  },
  {
    code: "ECONOMICS", nameEn: "Economics", nameHi: "अर्थशास्त्र", icon: "chart-no-axes-combined", color: "lime",
    chapters: {
      11: ["Introduction to Economics", "Consumer Behaviour", "Producer Behaviour", "Forms of Market", "Price Determination", "Introduction to Statistics", "Collection and Organisation of Data", "Presentation of Data", "Statistical Tools", "Index Numbers"],
      12: ["National Income Accounting", "Money and Banking", "Income and Employment", "Government Budget", "Open Economy Macroeconomics", "Indian Economy on the Eve of Independence", "Indian Economy 1950–1990", "Liberalisation and Globalisation", "Human Capital Formation", "Rural Development", "Employment", "Environment and Sustainable Development"],
    },
  },
  {
    code: "HISTORY", nameEn: "History", nameHi: "इतिहास", icon: "scroll-text", color: "stone",
    chapters: {
      11: ["Early Cities and Writing", "Empires Across Continents", "Nomadic Societies", "Feudal Society", "Changing Cultural Traditions", "Displacing Indigenous Peoples", "Paths to Modernisation"],
      12: ["Harappan Archaeology", "Kings, Farmers and Towns", "Kinship, Caste and Class", "Thinkers, Beliefs and Buildings", "Travellers' Accounts", "Bhakti and Sufi Traditions", "Vijayanagara", "Peasants and the Mughal State", "Colonialism and the Countryside", "The Revolt of 1857", "Mahatma Gandhi and the National Movement", "Framing the Constitution"],
    },
  },
  {
    code: "GEOGRAPHY", nameEn: "Geography", nameHi: "भूगोल", icon: "earth", color: "emerald",
    chapters: {
      11: ["Geography as a Discipline", "Origin and Evolution of the Earth", "Interior of the Earth", "Landforms", "Atmosphere", "World Climate", "Oceans", "Life on Earth", "India: Location", "Physiography", "Drainage", "Climate", "Natural Vegetation", "Natural Hazards"],
      12: ["Human Geography", "World Population", "Human Development", "Primary Activities", "Secondary Activities", "Tertiary Activities", "Transport and Communication", "International Trade", "Population of India", "Human Settlements", "Land Resources and Agriculture", "Water Resources", "Mineral and Energy Resources", "Planning and Sustainable Development", "Geographical Perspectives on Issues"],
    },
  },
  {
    code: "POLITICAL_SCIENCE", nameEn: "Political Science", nameHi: "राजनीति विज्ञान", icon: "landmark", color: "red",
    chapters: {
      11: ["Constitution: Why and How", "Rights in the Constitution", "Election and Representation", "Executive", "Legislature", "Judiciary", "Federalism", "Local Governments", "Political Theory", "Freedom", "Equality", "Social Justice", "Citizenship", "Nationalism", "Secularism"],
      12: ["The End of Bipolarity", "Contemporary Centres of Power", "South Asia", "International Organisations", "Security", "Environment and Natural Resources", "Globalisation", "Challenges of Nation-Building", "One-Party Dominance", "Planned Development", "India's External Relations", "Crisis of Democratic Order", "Regional Aspirations", "Recent Developments in Indian Politics"],
    },
  },
  {
    code: "SOCIOLOGY", nameEn: "Sociology", nameHi: "समाजशास्त्र", icon: "users", color: "pink",
    chapters: {
      11: ["Sociology and Society", "Terms, Concepts and Their Use", "Understanding Social Institutions", "Culture and Socialisation", "Doing Sociology", "Social Structure and Stratification"],
      12: ["Introducing Indian Society", "Demographic Structure", "Social Institutions", "Market as a Social Institution", "Social Inequality and Exclusion", "Cultural Diversity", "Structural Change", "Cultural Change", "Rural Society", "Industrial Society", "Social Movements"],
    },
  },
  {
    code: "PSYCHOLOGY", nameEn: "Psychology", nameHi: "मनोविज्ञान", icon: "brain", color: "fuchsia",
    chapters: {
      11: ["What is Psychology", "Methods of Enquiry", "Human Development", "Sensory and Perceptual Processes", "Learning", "Memory", "Thinking", "Motivation and Emotion"],
      12: ["Variations in Psychological Attributes", "Self and Personality", "Meeting Life Challenges", "Psychological Disorders", "Therapeutic Approaches", "Attitude and Social Cognition", "Social Influence and Group Processes"],
    },
  },
  {
    code: "PHYSICAL_EDUCATION", nameEn: "Physical Education", nameHi: "शारीरिक शिक्षा", icon: "dumbbell", color: "amber",
    chapters: {
      11: ["Changing Trends in Physical Education", "Olympism", "Yoga", "Physical Education for Children with Special Needs", "Physical Fitness and Wellness", "Testing and Measurement", "Anatomy and Physiology", "Kinesiology and Biomechanics", "Psychology and Sports", "Training and Doping"],
      12: ["Management of Sporting Events", "Children and Women in Sports", "Yoga for Preventive Health", "Physical Education for Children with Special Needs", "Sports and Nutrition", "Test and Measurement", "Physiology and Sports Injuries", "Biomechanics and Sports", "Psychology and Sports", "Training in Sports"],
    },
  },
];

function chapterCode(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase()
    .slice(0, 80) || `UNIT_${Buffer.from(title).toString("hex").slice(0, 12).toUpperCase()}`;
}

export async function seedCurriculumCatalog(prisma: PrismaClient, cbse: Board, classRows: AcademicClass[]) {
  let offeringCount = 0;
  let chapterCount = 0;
  for (const subjectSeed of curriculumCatalog) {
    const subject = await prisma.subject.upsert({
      where: { code: subjectSeed.code },
      update: { nameEn: subjectSeed.nameEn, nameHi: subjectSeed.nameHi, icon: subjectSeed.icon, color: subjectSeed.color, isActive: true },
      create: { code: subjectSeed.code, nameEn: subjectSeed.nameEn, nameHi: subjectSeed.nameHi, icon: subjectSeed.icon, color: subjectSeed.color },
    });
    for (const [levelText, chapterTitles] of Object.entries(subjectSeed.chapters)) {
      const level = Number(levelText);
      const academicClass = classRows.find((item) => item.levelOrder === level);
      if (!academicClass) continue;
      const offering = await prisma.classOffering.upsert({
        where: { boardId_classId_subjectId: { boardId: cbse.id, classId: academicClass.id, subjectId: subject.id } },
        update: { syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1", isActive: true },
        create: { boardId: cbse.id, classId: academicClass.id, subjectId: subject.id, syllabusVersion: "NCERT-ALIGNED-2026-EDITORIAL-V1" },
      });
      offeringCount += 1;
      for (const [index, title] of chapterTitles.entries()) {
        const code = chapterCode(title);
        const chapter = await prisma.chapter.upsert({
          where: { offeringId_code: { offeringId: offering.id, code } },
          update: {
            titleEn: title,
            descriptionEn: `Original ${subjectSeed.nameEn} learning unit mapped to the Class ${level} NCERT-aligned editorial scope.`,
            sequence: index + 1,
            isActive: true,
          },
          create: {
            offeringId: offering.id,
            code,
            titleEn: title,
            descriptionEn: `Original ${subjectSeed.nameEn} learning unit mapped to the Class ${level} NCERT-aligned editorial scope.`,
            sequence: index + 1,
          },
        });
        const topic = await prisma.topic.upsert({
          where: { chapterId_code: { chapterId: chapter.id, code: "EDITORIAL_OVERVIEW" } },
          update: { titleEn: `${title} learning pathway`, sequence: 1, isActive: true },
          create: { chapterId: chapter.id, code: "EDITORIAL_OVERVIEW", titleEn: `${title} learning pathway`, sequence: 1 },
        });
        await prisma.concept.upsert({
          where: { topicId_code: { topicId: topic.id, code: "ORIGINAL_LESSON_V1" } },
          update: { titleEn: `${title}: original lesson`, status: "DRAFT" },
          create: { topicId: topic.id, code: "ORIGINAL_LESSON_V1", titleEn: `${title}: original lesson`, sequence: 1, status: "DRAFT" },
        });
        chapterCount += 1;
      }
    }
  }
  return { offeringCount, chapterCount };
}
