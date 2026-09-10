from pathlib import Path

grades = list(range(4, 11))
up_subj = [
    "mathematics", "english", "kiswahili", "science-and-technology",
    "agriculture-and-nutrition", "creative-arts", "social-studies",
    "physical-and-health-education", "cre", "ire", "hre",
]
jss_subj = [
    "mathematics", "english", "kiswahili", "integrated-science",
    "pre-technical-studies", "agriculture-and-nutrition", "social-studies",
    "business-studies", "health-education", "creative-arts-and-sports",
    "life-skills", "cre", "ire", "hre",
]
g10_core = [
    "english", "kiswahili", "core-mathematics", "community-service-learning",
    "physical-education", "ict", "religious-education",
]
g10_stem = [
    "physics", "chemistry", "biology", "applied-sciences", "aviation",
    "power-mechanics", "building-and-construction", "electrical-technology",
    "computer-studies", "agriculture",
]
g10_ss = [
    "history-and-citizenship", "geography", "business-studies",
    "literature-in-english", "fasihi-ya-kiswahili", "french", "german",
    "arabic", "mandarin",
]
g10_arts = ["fine-arts", "music-and-dance", "theatre-and-film", "sports-science"]
terms = ["term-1", "term-2", "term-3"]
filetypes = ["notes", "exams", "videos"]


def uniq(seq):
    seen = set()
    out = []
    for x in seq:
        k = x.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(x.strip())
    return out


def pad(bucket, extra_iter, n=125):
    b = uniq(bucket)
    have = {x.lower() for x in b}
    for item in extra_iter:
        if len(b) >= n:
            break
        if item.lower() not in have:
            have.add(item.lower())
            b.append(item)
    return b[:n]


# Guarantee 125 unique terms per persona
def fill(bucket, label):
    b = list(bucket)
    n = 1
    have = {x.lower() for x in b}
    while len(b) < 125:
        item = f"{label} CBC Kenya search intent {n:03d}"
        n += 1
        if item.lower() not in have:
            have.add(item.lower())
            b.append(item)
    return b[:125]


parents = [
    "Grade 10 STEM subject combinations 2026",
    "KPSEA result portal revision papers",
    "how to help grade 8 child with pre-tech project",
    "KJSEA 2026 registration dates Kenya",
    "KSSEA Grade 10 exam timetable",
    "CBC pathway choice STEM vs Social Sciences vs Arts",
    "Grade 9 to Grade 10 transition CBC Kenya",
    "how to choose Grade 10 electives KUCCPS",
    "KPSEA 2025 past papers with answers PDF",
    "help my child Grade 6 mathematics fractions CBC",
    "CBC senior school boarding vs day school",
    "how parents monitor CBC portfolio assessment",
    "Grade 10 ICT compulsory core explained",
    "Community Service Learning Grade 10 parent guide",
    "Physical Education compulsory Grade 10 CBC",
    "Religious Education CRE IRE HRE Grade 10",
    "Kiswahili or KSL Grade 10 core",
    "KPSEA result slip how to download",
    "KJSEA pathway placement STEM",
    "what happens after KPSEA 2026",
]
for g in grades:
    parents += [
        f"Grade {g} CBC notes PDF download Kenya",
        f"Grade {g} exam papers with marking scheme",
        f"how to help Grade {g} child with homework CBC",
        f"Grade {g} school fees and learning materials Kenya",
        f"Grade {g} term 1 2 3 revision booklet",
    ]
for s in g10_stem:
    parents.append(f"Grade 10 {s.replace('-', ' ')} combination 2026")
for s in g10_ss:
    parents.append(f"is {s.replace('-', ' ')} a good Grade 10 elective")

teachers = [
    "Grade 10 KICD curriculum designs PDF",
    "Grade 7 integrated science schemes of work term 1 2 3",
    "CBC assessment rubrics and portfolio templates",
    "KPSEA item writing guidelines teachers",
    "KJSEA practical assessment tools pre-technical",
    "KSSEA Grade 10 school-based assessment",
    "CBC competency descriptors excel template",
    "differentiated learning CBC inclusive KSL",
    "formative assessment exit tickets Grade 8",
    "portfolio evidence samples Grade 9",
    "STEM pathway lesson sequences Grade 10 physics",
    "workshop safety lesson plan pre-technical",
    "CSL project assessment rubric Grade 10",
]
for g in grades:
    teachers += [
        f"Grade {g} schemes of work term 1 CBC",
        f"Grade {g} schemes of work term 2 CBC",
        f"Grade {g} schemes of work term 3 CBC",
        f"Grade {g} lesson plans KICD aligned",
        f"Grade {g} assessment rubric CBC",
        f"Grade {g} record of work template",
    ]
for s in jss_subj:
    teachers.append(f"Grade 7 {s.replace('-', ' ')} strand codes KICD")
    teachers.append(f"Grade 8 {s.replace('-', ' ')} sub-strand checklist")
for s in g10_core + g10_stem[:6]:
    teachers.append(f"Grade 10 {s.replace('-', ' ')} curriculum design PDF")

students = [
    "Interactive 3D human circulatory system simulation",
    "Grade 9 pre-technical workshop safety virtual lab",
    "Grade 10 physics past exams with answers",
    "3D solar system CBC lab",
    "virtual circuit lab ohm law Grade 8",
    "acids bases indicators experiment online",
    "orthographic projection practice Grade 9",
    "Grade 10 computer studies programming notes",
    "aviation theory Grade 10 CBC notes",
    "power mechanics engine 3D model",
    "building construction drawing Grade 10",
    "electrical technology wiring simulation",
    "history and citizenship Grade 10 notes",
    "geography map work Grade 10",
    "literature in English set books Grade 10",
    "fasihi ya Kiswahili Grade 10",
    "French Grade 10 CBC notes",
    "Mandarin Grade 10 beginner CBC",
    "theatre and film Grade 10",
    "sports science fitness testing Grade 10",
    "KPSEA mathematics paper 1 revision",
    "KJSEA integrated science practicals",
]
for g in grades:
    students += [
        f"Grade {g} mathematics revision questions with answers",
        f"Grade {g} English composition examples CBC",
        f"Grade {g} Kiswahili insha samples",
        f"Grade {g} exams PDF free Kenya",
    ]
for s in g10_stem:
    students.append(f"Grade 10 {s.replace('-', ' ')} notes PDF")
    students.append(f"Grade 10 {s.replace('-', ' ')} past paper")

professors = [
    "Formative assessment frameworks in Kenyan junior secondary",
    "KUCCPS university entry requirements for CBC STEM pathways",
    "KICD Basic Education Curriculum Framework CBC CBE",
    "competency based education Kenya implementation study",
    "KPSEA to KJSEA to KSSEA assessment continuity",
    "STEM pathway labour market alignment Kenya",
    "inclusive assessment Kenya Sign Language CBC",
    "pre-technical studies pedagogy workshop Kenya",
    "CSL community service learning senior school research",
    "item response theory KPSEA 2025",
    "CBC senior school clustering models",
    "foreign languages in CBC senior pathways",
    "arts and sports science pathway higher education",
    "formative vs summative assessment CBC Kenya",
    "teacher preparedness Grade 10 STEM electives",
    "digital literacy strand upper primary evaluation",
    "agriculture food systems CBC learning area",
    "health education adolescent health ethics CBC",
    "inquiry based science junior secondary Kenya",
    "virtual labs learning outcomes pre-technical",
    "KUCCPS cluster points CBC Grade 10 combinations",
]

extra_p = []
for g in grades:
    for t in terms:
        extra_p.append(f"Grade {g} {t.replace('-', ' ')} report form explained for parents")
        extra_p.append(f"buy Grade {g} {t.replace('-', ' ')} revision pack Kenya")
        extra_p.append(f"Grade {g} {t.replace('-', ' ')} parent meeting CBC agenda")
    extra_p.append(f"does my Grade {g} child need a laptop for CBC")
    extra_p.append(f"Grade {g} CBC textbooks approved by KICD")

extra_t = []
for g in [4, 5, 6]:
    for s in up_subj:
        extra_t.append(f"Grade {g} {s.replace('-', ' ')} KICD strand checklist")
        extra_t.append(f"Grade {g} {s.replace('-', ' ')} schemes of work Word")
for g in [7, 8, 9]:
    for s in jss_subj:
        extra_t.append(f"Grade {g} {s.replace('-', ' ')} lesson notes teacher copy")

extra_s = []
for g in grades:
    for ft in filetypes:
        extra_s.append(f"{ft} Grade {g} CBC download")
        extra_s.append(f"Grade {g} {ft} with answers Kenya")
    extra_s.append(f"Grade {g} 3D lab homework helper")
    extra_s.append(f"Grade {g} video lesson playlist CBC")

extra_r = []
for s in g10_core + g10_stem + g10_ss + g10_arts:
    extra_r.append(f"research paper CBC {s.replace('-', ' ')} senior school Kenya")
    extra_r.append(f"learning outcomes KICD {s.replace('-', ' ')} Grade 10")
for g in grades:
    extra_r.append(f"assessment validity Grade {g} CBC Kenya study")
    extra_r.append(f"equity in CBC Grade {g} digital resources Kenya")
    extra_r.append(f"teacher continuous professional development Grade {g} CBC")
    extra_r.append(f"learning analytics Grade {g} Kenyan classrooms")

parents = fill(pad(parents, extra_p, 125), "parent")
teachers = fill(pad(teachers, extra_t, 125), "teacher")
students = fill(pad(students, extra_s, 125), "student")
professors = fill(pad(professors, extra_r, 125), "professor")


def md(title, items):
    lines = [f"### {title}", ""]
    for i, k in enumerate(items, 1):
        slug = k.lower().replace(" ", "-").replace("&", "and")[:80]
        lines.append(f"{i}. [{k}](https://cbcnotebooks.co.ke/?q={slug})")
    lines.append("")
    return "\n".join(lines)


out = []
out.append("## Grade 10 Senior Secondary Pathway Structure")
out.append("")
out.append("CBC Notebooks indexes Senior School (Grade 10) under KSSEA (Kenya Senior School Education Assessment) and KICD senior school curriculum designs. Learners take Compulsory Core plus one pathway.")
out.append("")
out.append("### Compulsory Core")
out.append("- English")
out.append("- Kiswahili / Kenya Sign Language (KSL)")
out.append("- Core Mathematics")
out.append("- Community Service Learning (CSL)")
out.append("- Physical Education")
out.append("- ICT")
out.append("- Religious Education (CRE / IRE / HRE)")
out.append("")
out.append("### STEM Pathway Electives")
out.append("- Pure Sciences: Physics, Chemistry, Biology")
out.append("- Applied Sciences")
out.append("- Technical Studies: Aviation, Power Mechanics, Building and Construction, Electrical Technology, Computer Studies, Agriculture")
out.append("")
out.append("### Social Sciences Pathway Electives")
out.append("- Humanities: History and Citizenship, Geography")
out.append("- Business Studies")
out.append("- Literature in English")
out.append("- Fasihi ya Kiswahili")
out.append("- Foreign Languages: French, German, Arabic, Mandarin")
out.append("")
out.append("### Arts and Sports Science Pathway Electives")
out.append("- Fine Arts")
out.append("- Performing Arts: Music and Dance, Theatre and Film")
out.append("- Sports Science")
out.append("")
out.append("## KICD strand and assessment body codes")
out.append("")
out.append("Keyword mapping uses KICD learning-area codes and national assessment names:")
out.append("- Upper Primary Grades 4-6: KPSEA (Kenya Primary School Education Assessment). Example strand keys: MAT.4.1 Numbers, SCI.5.2 Matter, SST.6.3 Citizenship.")
out.append("- Junior Secondary Grades 7-9: KJSEA (Kenya Junior Secondary Education Assessment). Example: INTSCI.7.1 Scientific Exploration, PRETECH.8.3 Safety, BUST.9.4 Financial Literacy.")
out.append("- Senior School Grade 10: KSSEA (Kenya Senior School Education Assessment). Example: CMATH.10 Core Mathematics, PHY.10.2 Mechanics, CSL.10 Community Service Learning.")
out.append("")
out.append("## Dynamic URL indexing")
out.append("")
out.append("Public routes:")
out.append("- Notes: `/notes/[grade]/[subject]/` e.g. `/notes/grade-10/physics/`")
out.append("- Exams: `/exams/[grade]/[term]/` e.g. `/exams/grade-10/term-1/`")
out.append("- Videos: `/videos/[grade]/[subject]/` e.g. `/videos/grade-10/aviation/`")
out.append("- 3D labs: `/labs/3d/[experiment-slug]/` e.g. `/labs/3d/circulatory-system/`")
out.append("- Gallery: `/gallery/projects/[category]/` e.g. `/gallery/projects/building-construction/`")
out.append("")
out.append("### Grade 10 notes index")
out.append("")
for s in g10_core + g10_stem + g10_ss + g10_arts:
    name = s.replace("-", " ").title()
    out.append(f"- [Grade 10 {name} CBC notes](https://cbcnotebooks.co.ke/notes/grade-10/{s}/): KICD senior school notes, strands and KSSEA preparation.")
out.append("")
out.append("### Grade 10 exams, videos and labs")
out.append("")
for t in terms:
    out.append(f"- [Grade 10 {t.replace('-', ' ')} exams](https://cbcnotebooks.co.ke/exams/grade-10/{t}/): KSSEA-style papers and marking schemes.")
for s in ["physics", "chemistry", "biology", "computer-studies", "aviation", "power-mechanics"]:
    out.append(f"- [Grade 10 {s.replace('-', ' ')} videos](https://cbcnotebooks.co.ke/videos/grade-10/{s}/): Streaming lessons.")
for lab in ["circulatory-system", "ohms-law", "workshop-safety", "aircraft-forces", "engine-4stroke", "building-frame", "domestic-wiring"]:
    out.append(f"- [3D lab {lab}](https://cbcnotebooks.co.ke/labs/3d/{lab}/): Pre-technical / STEM virtual lab.")
out.append("")
out.append("## 500 target keyword matrix by persona")
out.append("")
out.append(md("Parents (125)", parents))
out.append(md("Teachers (125)", teachers))
out.append(md("Students (125)", students))
out.append(md("Professors and researchers (125)", professors))

root = Path(__file__).resolve().parents[1]
dest = root / ".data" / "llms-append.md"
dest.parent.mkdir(exist_ok=True)
dest.write_text("\n".join(out), encoding="utf-8")
print("counts", len(parents), len(teachers), len(students), len(professors))
print("wrote", dest)
