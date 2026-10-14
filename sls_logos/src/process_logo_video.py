# process_logo_video.py — Dave's Foundry hex-glow capture of the combined RFI + Bad Eden logo → web-ready loop.
#   crops the 300px letterbox bars (and 8px pillars), dims the two hex-grid bursts to K of their strength (blend toward
#   the interpolated clean frame), loop-cuts at 506 frames (glow phase match) with a 24-frame cross-dissolve, and fades
#   110px at every edge so the clipped grid melts into the page black. Then: scale=1920 → mp4 (crf 23) + webm (crf 33) + poster.
#   usage: source ~/.venvs/overlay/bin/activate && python3 -I sls_logos/src/process_logo_video.py [K=0.4]

import subprocess, sys, numpy as np
SRC="/Users/gamingaccount/sls_logos/rfi_bad_eden_animated_logo.mp4"
OUT="/Users/gamingaccount/sls_logos/final/rfi_bad_eden_animated_logo_trimmed.mp4"
W,H=3824,1558; CROP=f"crop={W}:{H}:8:300"
LOOP_FRAMES=506            # frames 0..505; frame 506 ≈ frame 0 (glow phase match)
K=float(sys.argv[1]) if len(sys.argv)>1 else 0.4   # burst strength kept (1.0 = untouched)
BURSTS=[(203,216,202,217),(425,436,424,437)]       # (first,last, clean-before, clean-after) 0-indexed
FADE=110
def grab(n):
    p=subprocess.run(["ffmpeg","-v","error","-i",SRC,"-vf",f"select=eq(n\\,{n}),{CROP}","-vsync","0","-frames:v","1","-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True,check=True)
    return np.frombuffer(p.stdout,np.uint8).reshape(H,W,3).astype(np.float32)
clean={n:grab(n) for b in BURSTS for n in (b[2],b[3])}
# loop sanity: frame 506 vs frame 0, against consecutive-frame diff
XF=24  # cross-dissolve the first XF output frames with the frames just past the loop point
tail=[grab(LOOP_FRAMES+i) for i in range(XF)]
# edge fade mask (smoothstep over FADE px on every side)
def ramp(n):
    t=np.clip(np.arange(n)/FADE,0,1); t=np.minimum(t,np.clip((n-1-np.arange(n))/FADE,0,1)); return t*t*(3-2*t)
mask=(ramp(H)[:,None]*ramp(W)[None,:])[:,:,None].astype(np.float32)
dec=subprocess.Popen(["ffmpeg","-v","error","-i",SRC,"-vf",CROP,"-frames:v",str(LOOP_FRAMES),"-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
enc=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r","24","-i","-","-an","-c:v","libx264","-preset","slow","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",OUT],stdin=subprocess.PIPE)
n=0; sz=W*H*3
while True:
    buf=dec.stdout.read(sz)
    if len(buf)<sz: break
    f=np.frombuffer(buf,np.uint8).reshape(H,W,3).astype(np.float32)
    for a,b,pre,post in BURSTS:
        if a<=n<=b:
            t=(n-pre)/(post-pre); base=clean[pre]*(1-t)+clean[post]*t
            f=base+K*(f-base)
    if n<XF:
        a=(n+1)/(XF+1); f=(1-a)*tail[n]+a*f
    f=f*mask
    enc.stdin.write(np.clip(f,0,255).astype(np.uint8).tobytes()); n+=1
    if n%100==0: print("frame",n,flush=True)
dec.stdout.close(); enc.stdin.close(); dec.wait(); enc.wait()
print("done frames",n,"rc",enc.returncode)
