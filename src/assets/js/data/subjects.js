/**
 * Curriculum catalogue — Upper Primary (Grades 4–6), Junior Secondary (Grades 7–9)
 * and Senior School (Grade 10).
 */
import { SENIOR_SUBJECTS } from "./senior.js";

function topics(subjectId, rows) {
  return rows.map(([name, detail], i) => ({
    id: `${subjectId}-${i}`,
    name,
    detail,
  }));
}

const CORE_SUBJECTS = [
  {
    id: "up-math",
    name: "Mathematics",
    level: "up",
    photo: "/assets/img/sub-math.png",
    tint: "#2ec4b6",
    topics: topics("up-math", [
      ["Numbers", "Whole numbers, Addition, Subtraction, Multiplication, Division, Fractions, Decimals."],
      ["Measurement", "Length, Area, Volume and Capacity, Mass, Time, Money, Temperature."],
      ["Geometry", "Lines, Angles, 2D Shapes, 3D Shapes."],
      ["Data Handling", "Data collection, Recording, Representation (Tables, Bar graphs), Interpretation."],
      ["Algebra", "Simple algebraic expressions and linear equations."],
    ]),
  },
  {
    id: "up-eng",
    name: "English Language",
    level: "up",
    photo: "/assets/img/sub-english.png",
    tint: "#ff6a4a",
    topics: topics("up-eng", [
      ["Listening & Speaking", "Pronunciation, Listening comprehension, Public speaking, Conversation, Storytelling."],
      ["Reading", "Fluency, Vocabulary development, Intensive reading, Extensive reading, Comprehension."],
      ["Writing", "Handwriting, Punctuation, Sentence construction, Guided composition, Narrative & Descriptive writing."],
      ["Grammar & Language Patterns", "Nouns, Pronouns, Verbs & Tenses, Adjectives, Adverbs, Prepositions, Conjunctions."],
    ]),
  },
  {
    id: "up-kis",
    name: "Kiswahili / Kenya Sign Language",
    level: "up",
    photo: "/assets/img/sub-kiswahili.png",
    tint: "#e84a8a",
    topics: topics("up-kis", [
      ["Kusikiliza na Kuzungumza", "Vitendawili, Methali, Mazungumzo, Risala, Drama."],
      ["Kusoma", "Kusoma kwa sauti, Ufahamu, Msamiati, Fasihi simulizi na andishi."],
      ["Kuandika", "Insha za maelezo, Insha za barua, Punctuation (Vituo), Mwandiko bora."],
      ["Sarufi", "Nomino, Viwakilishi, Kitendo na Wakati, Vivumishi, Viunganishi, Kauli za vitendo."],
    ]),
  },
  {
    id: "up-sci",
    name: "Science and Technology",
    level: "up",
    photo: "/assets/img/sub-science.png",
    tint: "#7cb342",
    topics: topics("up-sci", [
      ["Living Things & Environment", "Plants (classification, functions), Animals (vertebrates, invertebrates), Human body systems (Digestive, Respiratory)."],
      ["Matter & Energy", "States of matter, Mixtures and solutions, Heat energy, Sound energy, Light energy."],
      ["Force & Energy", "Forces (push, pull, friction, gravity), Simple machines (levers, inclined planes, pulleys)."],
      ["Digital Literacy & Computing", "Basic computer operations, Internet safety, Simple coding concepts, Digital tools usage."],
    ]),
  },
  {
    id: "up-agr",
    name: "Agriculture and Nutrition",
    level: "up",
    photo: "/assets/img/sub-agriculture.png",
    tint: "#c4a035",
    topics: topics("up-agr", [
      ["Conserving Agricultural Environment", "Soil conservation, Water harvesting, Compost making."],
      ["Crop Production", "Vegetable growing, Fruit trees, Nursery management, Crop management practices."],
      ["Animal Production", "Small domestic animals, Poultry management, Animal feeding and hygiene."],
      ["Food and Nutrition", "Food groups, Balanced diets, Meal planning, Food preservation and storage."],
      ["Personal & Kitchen Hygiene", "Personal cleanliness, Safe handling of kitchen tools, Kitchen safety."],
    ]),
  },
  {
    id: "up-arts",
    name: "Creative Arts",
    level: "up",
    photo: "/assets/img/sub-arts.png",
    tint: "#7e6bff",
    topics: topics("up-arts", [
      ["Picture Making", "Drawing (Smudge, Value graduation), Painting, Collage, Mosaic."],
      ["Indigenous Crafts", "Pottery (Pinch method), Basketry/Weaving, Leatherwork, Beadwork."],
      ["3D Forms & Sculpture", "Carving, Construction, Modeling."],
      ["Music & Performance", "Singing (National anthem, Folk songs), Musical instruments (Melodic and non-melodic percussion, Western instruments), Rhythm and pitch."],
      ["Performing Arts", "Creative dance, Verse speaking, Skits and dramatization."],
    ]),
  },
  {
    id: "up-ss",
    name: "Social Studies",
    level: "up",
    photo: "/assets/img/sub-social.png",
    tint: "#3d8bfd",
    topics: topics("up-ss", [
      ["Natural Environment", "Physical features, Weather and climate, Vegetation patterns."],
      ["People and Population", "Origin and settlement of Kenyan communities, Population distribution."],
      ["Culture and Social Organization", "Culture, Festivals, Social leadership, Historical sites."],
      ["Resources and Economic Activities", "Agriculture, Forestry, Mining, Fishing, Tourism, Trade, Transport and Communication."],
      ["Citizenship and Governance", "National unity, Human rights, Democracy, Structure of Government in Kenya."],
    ]),
  },
  {
    id: "up-phe",
    name: "Physical and Health Education",
    level: "up",
    photo: "/assets/img/sub-phe.png",
    tint: "#2ec4b6",
    topics: topics("up-phe", [
      ["Athletics", "Running events, Jumping events, Throwing events."],
      ["Games", "Football, Netball, Volleyball, Basketball, Swimming, Gymnastics."],
      ["Health & Safety", "Personal hygiene, Safety during physical activities, First aid basics, Substance abuse prevention."],
    ]),
  },
  {
    id: "up-re",
    name: "Religious Education",
    level: "up",
    photo: "/assets/img/sub-re.png",
    tint: "#ff6a4a",
    topics: topics("up-re", [
      ["Christian Religious Education (CRE)", "Creation, The Bible, Life and Ministry of Jesus Christ, The Early Church, Christian Living, Christian Values."],
      ["Islamic Religious Education (IRE)", "Qur'an, Hadith, Pillars of Iman (Faith), Devotional Acts (Taharah, Swalah), Akhlaq (Manners), History of the Prophet."],
      ["Hindu Religious Education (HRE)", "Paramatma and Manifestations, Scriptures, Festivals, Values and Ethics, Yoga and Meditation."],
    ]),
  },
  {
    id: "jss-math",
    name: "Mathematics",
    level: "jss",
    photo: "/assets/img/sub-math.png",
    tint: "#2ec4b6",
    topics: topics("jss-math", [
      ["Numbers", "Rational numbers, Real numbers, Prime factorization, Squares and Square roots, Cubes and Cube roots, Rates, Ratios, Percentages, Proportions, Commercial Arithmetic."],
      ["Algebra", "Algebraic expressions, Linear equations and inequalities, Linear simultaneous equations, Quadratic expressions."],
      ["Geometry", "Angles and plane figures, Circles, Transformations (Reflection, Rotation, Translation, Enlargement), Loci, Scale drawing."],
      ["Measurements", "Perimeter, Area, Surface area, Volume and Capacity, Mass and Density, Time and Speed."],
      ["Statistics & Probability", "Data collection, Frequency distribution tables, Mean, Median, Mode, Pie charts, Histograms, Basic probability concepts."],
    ]),
  },
  {
    id: "jss-sci",
    name: "Integrated Science",
    level: "jss",
    photo: "/assets/img/sub-science.png",
    tint: "#7cb342",
    topics: topics("jss-sci", [
      ["Scientific Exploration", "Scientific inquiry skills, Laboratory apparatus and safety, Measurements in science."],
      ["Living Things & Biological Systems", "Cell structure and function, Classification of organisms, Reproduction in plants and animals, Human reproduction, Circulatory and Excretory systems."],
      ["Matter and Chemical Reactions", "Atomic structure, Periodic table, Elements, Compounds, Mixtures, Acids, Bases, Indicators, Chemical changes."],
      ["Energy, Force and Motion", "Types and conservation of energy, Magnetism, Static and Current electricity, Pressure, Rectilinear propagation of light, Reflection, Waves and Sound."],
      ["Earth and Space Science", "Weathering and rocks, Solar system, Water cycle and environmental conservation."],
    ]),
  },
  {
    id: "jss-tech",
    name: "Pre-Technical and Pre-Career Education",
    level: "jss",
    photo: "/assets/img/sub-tech.png",
    tint: "#c4a035",
    topics: topics("jss-tech", [
      ["Technical Drawing", "Drawing instruments, Freehand sketching, Plane geometry drawing, Orthographic and Isometric projections."],
      ["Materials and Tools", "Properties of metals, wood, plastics, and ceramics; Hand tools, Power tools, Care and maintenance."],
      ["Safety & Workplace Readiness", "Workshop safety, Occupational hazards, Personal Protective Equipment (PPE), Fire safety."],
      ["Basic Electronics & Electricity", "Circuit components, Ohm's Law, Soldering, Basic domestic wiring concepts."],
      ["Pre-Career Exploration", "Self-assessment, Career pathways in technical industries, Entrepreneurship in technical fields."],
    ]),
  },
  {
    id: "jss-agr",
    name: "Agriculture and Nutrition",
    level: "jss",
    photo: "/assets/img/sub-agriculture.png",
    tint: "#7cb342",
    topics: topics("jss-agr", [
      ["Agricultural Environment", "Soil fertility management, Soil erosion control, Water harvesting and management."],
      ["Crop Production", "Cereal crops, Legumes, Horticultural crops, Crop pests and disease management, Post-harvest handling."],
      ["Livestock Production", "Management of poultry, rabbits, cattle, goats, sheep; Animal health, Housing, Feeding."],
      ["Food and Culinary Arts", "Meal planning, Culinary techniques, Food safety, Food processing and preservation."],
      ["Textiles & Clothing", "Sewing techniques, Garment construction, Care of clothing and household linens."],
    ]),
  },
  {
    id: "jss-ss",
    name: "Social Studies",
    level: "jss",
    photo: "/assets/img/sub-social.png",
    tint: "#3d8bfd",
    topics: topics("jss-ss", [
      ["Physical & Human Geography", "Map work, Internal/External land-forming processes, Weather and Climate zones, Population distribution, Urbanization."],
      ["History & Culture", "Early humans, Migration and settlement in East Africa, Pre-colonial social and political organization, Scramble for Africa, Struggle for Independence in Kenya."],
      ["Civil and Governance Studies", "Constitution of Kenya, Devolution, Organs of State, Human Rights, International relations, Conflict resolution."],
    ]),
  },
  {
    id: "jss-bus",
    name: "Business Studies",
    level: "jss",
    photo: "/assets/img/sub-business.png",
    tint: "#e84a8a",
    topics: topics("jss-bus", [
      ["Introduction to Business", "Meaning, Importance, Business environment, Internal and external factors."],
      ["Forms of Business Units", "Sole proprietorships, Partnerships, Cooperatives, Companies, Public corporations."],
      ["Entrepreneurship", "Characteristics of entrepreneurs, Business ideas, Business plans, Ethics in business."],
      ["Financial Literacy & Accounting", "Money and banking, Sources of business finance, Basic bookkeeping, Cashbooks, Income statements."],
      ["Government and Business", "Government involvement in business, Taxation, Consumer protection."],
    ]),
  },
  {
    id: "jss-health",
    name: "Health Education",
    level: "jss",
    photo: "/assets/img/sub-health.png",
    tint: "#ff6a4a",
    topics: topics("jss-health", [
      ["Human Body & Health", "Personal hygiene, Growth and development, Adolescent health, Reproductive health."],
      ["Disease Prevention & Control", "Communicable diseases, Non-communicable diseases, Immunization, Vector control."],
      ["Nutrition & Wellness", "Lifestyle diseases, Food safety, Dietary guidelines across age groups."],
      ["Mental & Emotional Health", "Stress management, Substance abuse prevention, First aid, Emergency handling."],
    ]),
  },
  {
    id: "jss-arts",
    name: "Creative Arts and Sports",
    level: "jss",
    photo: "/assets/img/sub-arts.png",
    tint: "#7e6bff",
    topics: topics("jss-arts", [
      ["Visual Arts", "Drawing, Painting, Sculpting, Graphic design, Photography, Indigenous arts and craft exhibition."],
      ["Performing Arts", "Music performance (Solo/Group), Western & African instruments, Playwriting, Directing, Stage production, Dance styles."],
      ["Sports & Games", "Athletics, Team games (Tactics and rules in Football, Rugby, Basketball, Netball, Volleyball), Swimming, Gymnastics."],
    ]),
  },
  {
    id: "jss-eng",
    name: "English Language",
    level: "jss",
    photo: "/assets/img/sub-english.png",
    tint: "#ff6a4a",
    topics: topics("jss-eng", [
      ["Listening & Speaking", "Active listening, Debating, Oration, Interviewing skills, Oral literature presentation."],
      ["Reading", "Critical reading, Analysis of literary genres (Novels, Plays, Poetry, Short stories), Speed reading."],
      ["Writing", "Functional writing (Letters, CVs, Memos, Reports), Creative writing (Stories, Poems), Expository and argumentative essays."],
      ["Grammar & Usage", "Complex sentence structures, Direct and Indirect speech, Active and Passive voice, Vocabulary expansion."],
    ]),
  },
  {
    id: "jss-kis",
    name: "Kiswahili / Kenya Sign Language",
    level: "jss",
    photo: "/assets/img/sub-kiswahili.png",
    tint: "#e84a8a",
    topics: topics("jss-kis", [
      ["Kusikiliza na Kuzungumza", "Majadiliano, Uhawilishaji wa taarifa, Hotuba, Utangazaji."],
      ["Kusoma", "Uchanganuzi wa maandiko ya Fasihi simulizi na Fasihi andishi (Tamthilia, Riwaya, Ushaairi, Hadithi fupi)."],
      ["Kuandika", "Insha za kiutendaji (Barua rasmi, Kumbukumbu, Wasifu, Ripoti), Insha za ubunifu."],
      ["Sarufi", "Muundo wa sentensi, Aina za maneno, Upatanisho wa kisarufi, Mnyambuliko wa vitendo, Nyakati na hali."],
    ]),
  },
  {
    id: "jss-re",
    name: "Religious Education",
    level: "jss",
    photo: "/assets/img/sub-re.png",
    tint: "#c4a035",
    topics: topics("jss-re", [
      ["Christian Religious Education (CRE)", "Old Testament (Creation, Ancestors of Faith, Exodus, Kings and Prophets), New Testament (Gospels, Parables, Miracles, Passion and Resurrection), Church History, Christian Ethics (Sexuality, Work, Wealth, Environment)."],
      ["Islamic Religious Education (IRE)", "Quranic Exegesis (Tafsir), Hadith Studies, Pillars of Iman (Faith), Devotional Acts (Taharah, Swalah), Akhlaq (Manners), Islamic History and Civilization, Contemporary issues in Islam."],
      ["Hindu Religious Education (HRE)", "Vedic scriptures and philosophy, Lives of spiritual masters, Dharma and Karma, Universal values, Community service."],
    ]),
  },
  {
    id: "jss-life",
    name: "Life Skills Education",
    level: "jss",
    photo: "/assets/img/sub-life.png",
    tint: "#2ec4b6",
    topics: topics("jss-life", [
      ["Self-Awareness & Management", "Self-esteem, Stress management, Emotion control, Time management."],
      ["Interpersonal Relationships", "Communication skills, Empathy, Peer pressure management, Negotiation and Assertiveness."],
      ["Decision Making & Problem Solving", "Critical thinking, Creative thinking, Conflict resolution, Career decision-making."],
    ]),
  },
];

const SUBJECTS = CORE_SUBJECTS.concat(SENIOR_SUBJECTS);

export function matchesSubject(s, q) {
  if (!q) return true;
  const blob = (s.name + " " + s.topics.map((t) => t.name + " " + t.detail).join(" ")).toLowerCase();
  return blob.includes(q);
}

export const SLIDE_PHOTOS = Array.from(new Set(SUBJECTS.map((s) => s.photo)));

export { SUBJECTS };
