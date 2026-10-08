#!/usr/bin/env python3
"""Reusable contour and UV correspondence primitives extracted from the archived
Creeper reference without modifying it. Geometry helpers are atlas-independent.
Validation and safety controls are implemented in uv_align_guarded_v2.py.
"""
from collections import deque
import math
import cv2
import numpy as np

def load(path):
    im=cv2.imread(path,cv2.IMREAD_UNCHANGED)
    if im is None: raise FileNotFoundError(path)
    if im.ndim==2: im=cv2.cvtColor(im,cv2.COLOR_GRAY2BGRA)
    elif im.shape[2]==3: im=cv2.cvtColor(im,cv2.COLOR_BGR2BGRA)
    return cv2.cvtColor(im,cv2.COLOR_BGRA2RGBA)

def comps(mask,min_area=300):
    n,lab,st,ce=cv2.connectedComponentsWithStats(mask,4)
    out=[]
    for i in range(1,n):
        area=int(st[i,cv2.CC_STAT_AREA])
        if area<min_area: continue
        x,y,w,h=map(int,st[i,:4])
        out.append(dict(id=i,x=x,y=y,w=w,h=h,area=area,
                        cx=float(ce[i,0]),cy=float(ce[i,1]),
                        aspect=w/max(1,h)))
    out.sort(key=lambda c:(c["y"],c["x"]))
    return lab,out

def pair_components(oc,ac,W,H):
    q=[]
    for oi,o in enumerate(oc):
        for ai_i,a in enumerate(ac):
            pos=abs(o["cx"]-a["cx"])/W+abs(o["cy"]-a["cy"])/H
            size=abs(math.log((o["w"]+1)/(a["w"]+1)))+abs(math.log((o["h"]+1)/(a["h"]+1)))
            ar=abs(math.log((o["aspect"]+1e-6)/(a["aspect"]+1e-6)))
            q.append((pos*2.4+size*.8+ar*.7,oi,ai_i))
    q.sort()
    uo=set();ua=set();out=[]
    for cost,oi,ai_i in q:
        if oi in uo or ai_i in ua: continue
        uo.add(oi);ua.add(ai_i)
        out.append((oc[oi],ac[ai_i],cost))
    out.sort(key=lambda z:(z[0]["y"],z[0]["x"]))
    return out

def crop(img,lab,c):
    x,y,w,h=c["x"],c["y"],c["w"],c["h"]
    return img[y:y+h,x:x+w].copy(),(lab[y:y+h,x:x+w]==c["id"]).astype(np.uint8)

def poly(mask):
    cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    if not cs:return None
    c=max(cs,key=cv2.contourArea)
    peri=cv2.arcLength(c,True)
    return cv2.approxPolyDP(c,max(1.5,.0045*peri),True)[:,0,:].astype(np.float32)

def rectilinear(p):
    pts=[p[0].copy()]
    for z0 in p[1:]:
        z=z0.copy();q=pts[-1]
        if abs(z[0]-q[0])>=abs(z[1]-q[1]): z[1]=q[1]
        else: z[0]=q[0]
        if np.linalg.norm(z-q)>=1: pts.append(z)
    p=np.array(pts,np.float32)
    for _ in range(3):
        n=len(p)
        for i in range(n):
            a,b,c=p[i-1],p[i],p[(i+1)%n]
            ph=abs(b[0]-a[0])>=abs(b[1]-a[1])
            nh=abs(c[0]-b[0])>=abs(c[1]-b[1])
            if ph and not nh:
                b[1]=a[1];b[0]=c[0]
            elif not ph and nh:
                b[0]=a[0];b[1]=c[1]
    return p

def canonical(p):
    if cv2.contourArea(p.reshape(-1,1,2),oriented=True)<0:
        p=p[::-1]
    best=None
    for i in range(len(p)):
        a,b=p[i],p[(i+1)%len(p)]
        if abs(b[0]-a[0])<abs(b[1]-a[1]): continue
        key=(min(a[1],b[1]),-abs(b[0]-a[0]),min(a[0],b[0]))
        if best is None or key<best[0]: best=(key,i)
    if best:
        i=best[1]
        p=np.concatenate([p[i:],p[:i]])
    return p

def edges(p):
    p=canonical(p);out=[]
    for i in range(len(p)):
        a,b=p[i],p[(i+1)%len(p)]
        o="H" if abs(b[0]-a[0])>=abs(b[1]-a[1]) else "V"
        out.append(dict(i=i,a=a,b=b,o=o,L=float(np.linalg.norm(b-a))))
    return out

def ordered_pairs(tp,sp):
    te,se=edges(tp),edges(sp);out=[]
    for o in ("H","V"):
        tt=[e for e in te if e["o"]==o]
        ss=[e for e in se if e["o"]==o]
        k=min(len(tt),len(ss))
        for j in range(k):
            ti=round(j*(len(tt)-1)/max(1,k-1))
            si=round(j*(len(ss)-1)/max(1,k-1))
            out.append((tt[ti],ss[si]))
    return sorted(out,key=lambda z:z[0]["i"])

def cons(ps,o):
    arr=[]
    for t,s in ps:
        if t["o"]!=o:continue
        if o=="V":
            arr.append(((t["a"][0]+t["b"][0])/2,
                        (s["a"][0]+s["b"][0])/2,t["L"]))
        else:
            arr.append(((t["a"][1]+t["b"][1])/2,
                        (s["a"][1]+s["b"][1])/2,t["L"]))
    arr.sort();groups=[]
    for z in arr:
        if not groups or abs(z[0]-groups[-1][-1][0])>2:
            groups.append([z])
        else:
            groups[-1].append(z)
    d=[];s=[]
    for g in groups:
        wt=sum(z[2] for z in g)
        d.append(sum(z[0]*z[2] for z in g)/wt)
        s.append(sum(z[1]*z[2] for z in g)/wt)
    return d,s

def bounds(d,s,dmax,smax):
    p=sorted(list(zip(d,s))+[(0.,0.),(float(dmax),float(smax))])
    out=[]
    for z in p:
        if not out or abs(z[0]-out[-1][0])>1e-3:
            out.append(z)
    d=np.array([z[0] for z in out],np.float32)
    s=np.array([z[1] for z in out],np.float32)
    for i in range(1,len(s)):
        s[i]=max(s[i],s[i-1]+.5)
    return d,np.clip(s,0,smax)
