from pathlib import Path

root = Path(__file__).resolve().parents[1]
llms = root / "src" / "llms.txt"
append = (root / ".data" / "llms-append.md").read_text(encoding="utf-8")
text = llms.read_text(encoding="utf-8")
text = text.replace("Grades 4–9", "Grades 4–10")
text = text.replace("Grades 4-9", "Grades 4-10")
old = (
    "CBC Notebooks maps the Kenyan Competency-Based Curriculum (CBC / CBE) "
    "Basic Education Curriculum Framework for Upper Primary (Grades 4, 5 and 6, including KPSEA preparation) "
    "and Junior Secondary School (Grades 7, 8 and 9, including KJSEA preparation)."
)
new = (
    "CBC Notebooks maps the Kenyan Competency-Based Curriculum (CBC / CBE) "
    "Basic Education Curriculum Framework for Upper Primary (Grades 4, 5 and 6, including KPSEA), "
    "Junior Secondary School (Grades 7, 8 and 9, including KJSEA), "
    "and Senior School Grade 10 pathways (including KSSEA)."
)
if old in text:
    text = text.replace(old, new, 1)
if "## Grade 10 Senior Secondary Pathway Structure" not in text:
    text = text.rstrip() + "\n\n" + append + "\n"
llms.write_text(text, encoding="utf-8")
print("llms.txt bytes", llms.stat().st_size)
