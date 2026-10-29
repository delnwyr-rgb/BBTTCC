import json,re,sys,os
S=sys.argv[1]; OUT=S+'/out'; FIN=S+'/final'; os.makedirs(FIN,exist_ok=True)
s=json.load(open(S+'/ember-settings.json'));c=s['bbttcc-campaign.campaigns'];c=json.loads(c) if isinstance(c,str) else c
camp=c[s['bbttcc-campaign.activeCampaignId']];B={b['id']:b for b in camp['beats']}
reg=s.get('bbttcc-campaign.quests') or {}; sq=(camp.get('story') or {}).get('quests') or {}
qname=lambda q: (reg.get(q) or {}).get('name') or (sq.get(q) or {}).get('name') or q or '(no quest)'
HEAD=re.compile(r'^#### .*?\(`([^`]+)`'); MARK=re.compile(r'^\*\*(Step|Door|Arrival|After|Also in this quest|Also here|Chapter)\b.*\*\*\s*$')
def chunks(lines):
  """yield (kind, start, end, id): sections, markers, beat chunks"""
  out=[];i=0;n=len(lines)
  while i<n:
    l=lines[i]
    if l.startswith('## ') or l.startswith('# '): out.append(['sec',i,i+1,l]); i+=1; continue
    if MARK.match(l): out.append(['mark',i,i+1,l]); i+=1; continue
    m=HEAD.match(l)
    if m:
      j=i+1
      while j<n and not (lines[j].startswith('## ') or HEAD.match(lines[j]) or MARK.match(lines[j])): j+=1
      out.append(['beat',i,j,m.group(1)]); i=j; continue
    out.append(['text',i,i+1,l]); i+=1
  return out
def clean(lines):
  # drop markers with no beat before the next marker/section/EOF, then sections with no beats
  ch=chunks(lines); keep=[True]*len(ch)
  for k,x in enumerate(ch):
    if x[0]=='mark':
      nxt=next((y for y in ch[k+1:] if y[0]!='text' or y[3].strip()),None)
      if not nxt or nxt[0]!='beat': keep[k]=False
  ch=[x for x,kp in zip(ch,keep) if kp]; keep=[True]*len(ch)
  for k,x in enumerate(ch):
    if x[0]=='sec' and x[3].startswith('## '):
      nxt=next((y for y in ch[k+1:] if y[0] in('sec','beat')),None)
      if not nxt or nxt[0]!='beat': keep[k]=False
  res=[]
  for x,kp in zip(ch,keep):
    if kp: res.extend(lines[x[1]:x[2]])
  txt='\n'.join(res); txt=re.sub(r'\n{3,}','\n\n',txt).strip()+'\n'; return txt
pulled=[]  # (origin section title, beat id, lines)
tabs=[f for f in sorted(os.listdir(OUT)) if f.endswith('.md') and f not in('report.md','Expansion_pile.md')]
for f in tabs:
  L=open(f'{OUT}/{f}').read().split('\n'); sec=''; res=[]
  for x in chunks(L):
    if x[0]=='sec' and x[3].startswith('## '): sec=x[3][3:]
    if x[0]=='beat' and B.get(x[3],{}).get('_deferred'): pulled.append((sec,x[3],L[x[1]:x[2]])); continue
    res.extend(L[x[1]:x[2]])
  open(f'{FIN}/{f}','w').write(clean(res))
P=open(f'{OUT}/Expansion_pile.md').read().split('\n')
stray=[x[3] for x in chunks(P) if x[0]=='beat' and x[3] in B and not B[x[3]].get('_deferred')]
groups={}
for sec,i,ls in pulled:
  b=B[i]; key=(b.get('story') or {}).get('quest'); main=(sq.get(key) or {}).get('registryId')
  t=sec + ((' · '+qname(b.get('questId'))) if b.get('questId') and b.get('questId')!=main and qname(b.get('questId'))!=sec else '')
  groups.setdefault(t,[]).extend(ls+[''])
pile='\n'.join(P).rstrip()+'\n'
for t,ls in groups.items(): pile+='\n## '+t+'\n\n'+'\n'.join(ls)
open(f'{FIN}/Expansion_pile.md','w').write(clean(pile.split('\n')))
tot={}
for f in os.listdir(FIN):
  ids=[m.group(1) for m in (HEAD.match(l) for l in open(f'{FIN}/{f}')) if m]; tot[f]=ids
allids=[i for v in tot.values() for i in v]
print({k:len(v) for k,v in tot.items()}, 'total',len(allids),'unique',len(set(allids)))
print('pulled',len(pulled),'non-deferred left in pile',stray)
live=[b for b in camp['beats'] if not str(b['id']).startswith('evt_')]
print('live non-evt',len(live),'missing',[b['id'] for b in live if b['id'] not in set(allids)][:20])
print('deferred outside pile',[i for f,v in tot.items() if f!='Expansion_pile.md' for i in v if B.get(i,{}).get('_deferred')])
