import sys,json,base64,re
src,out=sys.argv[1],sys.argv[2]
arr=json.load(open(src)); t="".join(x.get("text","") for x in arr)
try: j=json.loads(t)
except Exception: j=None
def find(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in("bytes_b64","base64","b64") and isinstance(v,str): return v
            r=find(v)
            if r: return r
    if isinstance(o,list):
        for v in o:
            r=find(v)
            if r: return r
b=find(j) if j else None
if not b:
    m=re.search(r'"bytes_b64"\s*:\s*"([^"]+)"',t); b=m.group(1)
md=base64.b64decode(b).decode("utf-8"); open(out,"w").write(md)
print(out,len(md),md.count("\n#### "))
