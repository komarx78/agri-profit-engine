import os
import codecs

path = 'src/app/admin/map/page.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# fetch のクォートが消えた部分を復元
content = content.replace("await fetch(https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl= + lang + &dt=t&q= + encodeURIComponent(text));", "await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`);")
content = content.replace("await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=' + lang + '&dt=t&q=' + encodeURIComponent(text));", "await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`);")

# バッククォートが消えた select( を復元
content = content.replace(".select(\n          id,", ".select(`\n          id,")
content = content.replace("color\n        )\n        .order('name');", "color\n        `)\n        .order('name');")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
