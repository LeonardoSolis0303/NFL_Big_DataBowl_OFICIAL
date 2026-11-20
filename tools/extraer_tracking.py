import hashlib,json,subprocess,concurrent.futures,os
from pathlib import Path
root=Path(__file__).resolve().parent
m=json.loads((root/'manifest.json').read_text())
base=root.parent
(base/'data'/'tracking').mkdir(parents=True,exist_ok=True)
curl='curl.exe' if os.name=='nt' else 'curl'
def download(f):
    p=base/f['path']; tmp=p.with_suffix('.part')
    if p.exists() and p.stat().st_size==f['size'] and hashlib.sha1(f"blob {f['size']}\0".encode()+p.read_bytes()).hexdigest()==f['sha']:return True
    for ref in (m['ref'],'main',m['ref']):
        url='https://raw.githubusercontent.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data/'+ref+'/'+f['path']
        res=subprocess.run([curl,'-fsSL','--connect-timeout','10','--max-time','50','-o',str(tmp),url],capture_output=True)
        if res.returncode==0 and tmp.stat().st_size==f['size']:
            h=hashlib.sha1(f"blob {f['size']}\0".encode()); h.update(tmp.read_bytes())
            if h.hexdigest()==f['sha']:tmp.replace(p);return True
    print('failed',p.name,flush=True);return False
with concurrent.futures.ThreadPoolExecutor(max_workers=14) as pool:
    checks=list(pool.map(download,m['files']))
print(sum(checks),'de',len(checks),'archivos verificados',flush=True)
raise SystemExit(0 if all(checks) else 1)
