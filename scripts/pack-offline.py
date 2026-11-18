"""Pack the published app as one offline document. Optional: --font path to NotoSansKR.ttf."""
from pathlib import Path
from base64 import b64encode
from html.parser import HTMLParser
import argparse, json, re, mimetypes
from functools import lru_cache
repo=Path(__file__).resolve().parents[1]
root=repo/'docs'
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--font',type=Path);ap.add_argument('--output',type=Path,default=repo/'태양계 실험실.html')
args=ap.parse_args()
if args.font:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    font=TTFont(args.font);options=subset.Options();options.layout_features=['*'];sub=subset.Subsetter(options=options)
    text=''.join(p.read_text(encoding='utf-8') for p in root.iterdir() if p.suffix in ('.html','.css','.js'))
    sub.populate(text=''.join(sorted({c for c in text if ord(c)>127})));sub.subset(font);font.flavor='woff2';font.save(root/'assets/fonts/noto-kr.woff2')
@lru_cache(None)
def data(path):
    mime=mimetypes.guess_type(str(path))[0]
    mime={'woff2':'font/woff2','svg':'image/svg+xml','webp':'image/webp'}.get(path.suffix.lstrip('.'),mime)
    assert mime,path
    return 'data:'+mime+';base64,'+b64encode(path.read_bytes()).decode()
html=(root/'index.html').read_text(encoding='utf-8');css=(root/'style.css').read_text(encoding='utf-8')
html=html.replace('href="observatory/"', 'href="https://chadchad99.github.io/orbit-lab/observatory/"')
css=re.sub(r'url\("(assets/[^"]+)"\)',lambda m:'url("'+data(root/m[1])+'")',css)
assert 'url("assets/' not in css
html=re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">',lambda _: '<style>'+css+'</style>',html)
scripts=re.findall(r'<script defer src="([^"]+)"></script>',html)
assert scripts and scripts[-1].split('?',1)[0]=='app.js'
html=re.sub(r'<script defer src="[^"]+"></script>','',html)
html=re.sub(r'(?:src|href)="(assets/[^"]+)"',lambda m:m[0].split('=')[0]+'="'+data(root/m[1])+'"',html)
paths=[p for p in (root/'assets').rglob('*') if p.suffix in ('.png','.webp','.bin')]
inline='\n<script>globalThis.LabPacked='+json.dumps({p.relative_to(root).as_posix():data(p) for p in sorted(paths)},separators=(',',':'))+';</script>\n'
catalog=root/'assets/catalog'
# Scientific data is embedded as inert blocks; the browser decodes only requested pages.
blocks=[]
for item in sorted(catalog.rglob('*')):
    if item.suffix not in ('.json','.gz'):continue
    key=item.relative_to(catalog).as_posix()
    blocks.append('<script type="application/octet-stream" id="catalog-data-'+key+'">'+b64encode(item.read_bytes()).decode()+'</script>')
inline+=''.join(blocks)+'\n'
for name in scripts:
    code=(root/name.split('?',1)[0]).read_text(encoding='utf-8');assert '</script' not in code.lower()
    inline+='<script>'+code+'</script>\n'
licenses='\n'.join(p.read_text(encoding='utf-8') for p in [*sorted((root/'assets/fonts').glob('*OFL.txt')),root/'assets/vendor/satellite-LICENSE.txt'])
credits={p.name:json.loads(p.read_text(encoding='utf-8')) for p in sorted((root/'assets/space').glob('*-credits.json'))}
inline+='\n<script type="application/json" id="asset-attribution">'+json.dumps(credits,ensure_ascii=False).replace('<','\\u003c')+'</script>\n'
html=html.replace('</body>',inline+'\n<!-- Font licenses\n'+licenses.replace('--','—')+'\n-->\n</body>')
class Validate(HTMLParser):
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','img','link'):
            for field in ('href','src'):
                if field in a:assert a[field].startswith('data:'),a[field][:75]
Validate().feed(html)
out=args.output;tmp=out.with_suffix('.partial');tmp.write_text(html,encoding='utf-8');tmp.replace(out)
print(f'{out.name}: {out.stat().st_size:,} bytes, {len(paths)} embedded media files plus poster, {len(scripts)} scripts')
