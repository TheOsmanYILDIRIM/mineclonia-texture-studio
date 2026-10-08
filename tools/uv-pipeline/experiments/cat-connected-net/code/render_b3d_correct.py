#!/usr/bin/env python3
"""Static Mineclonia B3D model renderer for reproducible UV previews.

Reads triangle geometry and material ids from B3D, uses B3D's top-origin V
coordinates, respects the source texture's alpha (not RGB-black guesses), and
produces an orthographic, auto-framed reference pose. Meshes for optional props
(e.g. Enderman held block/flower) and Pig saddle are disabled by default.

This is a static-reference renderer, not the Luanti animation/lighting engine.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass
class Mesh:
    vertices: np.ndarray
    uv: np.ndarray
    faces: np.ndarray
    materials: np.ndarray
    nodes: list[str]


def _quat_rotation(q):
    w, x, y, z = q
    ss = float(np.dot(q, q))
    if ss <= 1e-12:
        return np.eye(3, dtype=np.float64)
    s = 2.0 / ss
    return np.array([
        [1-s*(y*y+z*z), s*(x*y-z*w), s*(x*z+y*w)],
        [s*(x*y+z*w), 1-s*(x*x+z*z), s*(y*z-x*w)],
        [s*(x*z-y*w), s*(y*z+x*w), 1-s*(x*x+y*y)]
    ], dtype=np.float64)


class Reader:
    def __init__(self, data: bytes):
        self.f = io.BytesIO(data)
        self.vertices: list[np.ndarray] = []
        self.uvs: list[np.ndarray] = []
        self.faces: list[tuple[int, int, int]] = []
        self.materials: list[int] = []
        self.nodes: list[str] = []
        self.vertex_count = 0
        tag, size = self.chunk_header()
        if tag != b'BB3D':
            raise ValueError('Not a B3D model')
        end = self.f.tell()+size
        ver = self.read('<i')[0]
        if ver < 1:
            raise ValueError(f'Unsupported B3D version {ver}')
        self.parse_chunks(end, np.eye(4), 'ROOT')
        if not self.faces:
            raise ValueError('No mesh triangles found')

    def read(self, fmt):
        n = struct.calcsize(fmt)
        b = self.f.read(n)
        if len(b) != n:
            raise EOFError('Truncated B3D input')
        return struct.unpack(fmt, b)

    def chunk_header(self):
        tag, size = self.read('<4sI')
        return tag, size

    def cstr(self):
        data = bytearray()
        while True:
            c = self.f.read(1)
            if not c:
                raise EOFError('Unterminated string')
            if c == b'\0':
                return data.decode('utf-8', errors='replace')
            data.extend(c)

    def parse_chunks(self, end, parent_transform, node_path):
        while self.f.tell() < end:
            tag, size = self.chunk_header()
            stop = self.f.tell() + size
            if stop > end:
                raise ValueError(f'Chunk {tag!r} extends beyond parent')
            if tag == b'NODE':
                name = self.cstr()
                pos_scale_quat = self.read('<10f')
                pos = np.asarray(pos_scale_quat[:3], float)
                scale = np.asarray(pos_scale_quat[3:6], float)
                quat = np.asarray(pos_scale_quat[6:10], float)
                xform = np.eye(4, dtype=np.float64)
                xform[:3, :3] = _quat_rotation(quat) @ np.diag(scale)
                xform[:3, 3] = pos
                self.parse_chunks(stop, parent_transform @ xform, node_path+'/'+name)
            elif tag == b'MESH':
                _ = self.read('<i')[0] # mesh default brush; TRIS may override
                self.read_mesh(stop, parent_transform, node_path)
            self.f.seek(stop)

    def read_mesh(self, end, transform, node_path):
        points = None
        texcoords = None
        mesh_triangles: list[tuple[int, int, int, int]] = []
        while self.f.tell() < end:
            tag, size = self.chunk_header()
            stop = self.f.tell() + size
            if stop > end:
                raise ValueError('Bad mesh chunk boundary')
            if tag == b'VRTS':
                flags, uv_sets, uv_size = self.read('<3i')
                stride = 3 + (3 if flags & 1 else 0) + (4 if flags & 2 else 0) + uv_sets*uv_size
                if stride <= 0 or (size-12)%(stride*4):
                    raise ValueError('Malformed B3D vertex buffer')
                count = (size-12)//(stride*4)
                vdata = np.frombuffer(self.f.read(count*stride*4), dtype='<f4').reshape(count,stride)
                index = 3 + (3 if flags&1 else 0) + (4 if flags&2 else 0)
                points = np.column_stack((vdata[:,:3],np.ones(count,dtype=np.float32)))
                texcoords = vdata[:,index:index+2].copy() if uv_sets and uv_size >= 2 else np.zeros((count,2),np.float32)
            elif tag == b'TRIS':
                material = self.read('<i')[0]
                count = (size-4)//12
                for face in struct.iter_unpack('<3i',self.f.read(count*12)):
                    mesh_triangles.append((*face, material))
            self.f.seek(stop)
        if points is None:
            return
        v = (transform @ points.T).T[:,:3]
        offset = self.vertex_count
        self.vertex_count += len(v)
        self.vertices.extend(v)
        self.uvs.extend(texcoords)
        for a,b,c,brush in mesh_triangles:
            if max(a,b,c)>=len(v) or min(a,b,c)<0:
                raise ValueError('Invalid B3D triangle index')
            self.faces.append((a+offset,b+offset,c+offset))
            self.materials.append(brush)
            self.nodes.append(node_path)

    def mesh(self):
        return Mesh(
            np.array(self.vertices,dtype=np.float64),
            np.array(self.uvs,dtype=np.float64),
            np.array(self.faces,dtype=np.int32),
            np.array(self.materials,dtype=np.int32),
            self.nodes)


def load_mesh(path):
    return Reader(Path(path).read_bytes()).mesh()


def select_faces(mesh: Mesh, *, include_props=False, include_saddle=False):
    selected = np.ones(len(mesh.faces),dtype=bool)
    for idx,(node,material) in enumerate(zip(mesh.nodes,mesh.materials)):
        leaf = node.split('/')[-1].lower()
        if not include_props and (leaf.startswith('cube_') or 'flower' in leaf):
            selected[idx] = False
        if not include_saddle and material == 1 and ('pig' in node.lower()):
            selected[idx] = False
    return selected


def project_ortho(mesh: Mesh, width:int, height:int, yaw:float, pitch:float, selected):
    indices=np.unique(mesh.faces[selected].reshape(-1))
    v=mesh.vertices.copy()
    center=(v[indices].min(axis=0)+v[indices].max(axis=0))*0.5
    v-=center
    ya,pi = np.deg2rad([yaw,pitch])
    ry=np.array([[np.cos(ya),0,np.sin(ya)],[0,1,0],[-np.sin(ya),0,np.cos(ya)]])
    rx=np.array([[1,0,0],[0,np.cos(pi),-np.sin(pi)],[0,np.sin(pi),np.cos(pi)]])
    v=(rx @ ry @ v.T).T
    bounds = np.ptp(v[indices,:2],axis=0)
    scale=min((width*0.84)/max(bounds[0],1e-5),(height*0.84)/max(bounds[1],1e-5))
    center2 = 0.5*(v[indices,:2].min(axis=0)+v[indices,:2].max(axis=0))
    sx=(v[:,0]-center2[0])*scale + width/2
    sy=(center2[1]-v[:,1])*scale + height/2
    # viewing from positive Z, so front surface has greater rotated Z
    sz=-v[:,2]
    return np.stack([sx,sy,sz],axis=-1)


def render(mesh: Mesh, texture:Image.Image, *, width=600,height=600,yaw=35.,pitch=17.,
           include_props=False,include_saddle=False):
    tex=np.array(texture.convert('RGBA'),dtype=np.uint8)
    selected=select_faces(mesh,include_props=include_props,include_saddle=include_saddle)
    if not selected.any():
        raise ValueError('No visible faces selected')
    projected=project_ortho(mesh,width,height,yaw,pitch,selected)
    rgba=np.zeros((height,width,4),np.uint8)
    zbuffer=np.full((height,width),np.inf,dtype=np.float64)
    draw_count=0
    for tri in mesh.faces[selected]:
        pix=projected[tri]
        uv=mesh.uv[tri]
        x0=max(0,int(np.floor(np.min(pix[:,0])))); x1=min(width-1,int(np.ceil(np.max(pix[:,0]))))
        y0=max(0,int(np.floor(np.min(pix[:,1])))); y1=min(height-1,int(np.ceil(np.max(pix[:,1]))))
        if x1<x0 or y1<y0: continue
        xA,yA=pix[0,:2];xB,yB=pix[1,:2];xC,yC=pix[2,:2]
        denominator=(yB-yC)*(xA-xC)+(xC-xB)*(yA-yC)
        if abs(denominator)<1e-7:continue
        # Each raster pixel sampled at its CENTER. Full vectorization per triangle.
        xx,yy=np.meshgrid(np.arange(x0,x1+1)+0.5,np.arange(y0,y1+1)+0.5)
        w0=((yB-yC)*(xx-xC)+(xC-xB)*(yy-yC))/denominator
        w1=((yC-yA)*(xx-xC)+(xA-xC)*(yy-yC))/denominator
        w2=1.-w0-w1
        inside=(w0>=-1e-6)&(w1>=-1e-6)&(w2>=-1e-6)
        if not inside.any(): continue
        z=w0*pix[0,2]+w1*pix[1,2]+w2*pix[2,2]
        roi_z=zbuffer[y0:y1+1,x0:x1+1]
        visible=inside & (z < roi_z-1e-7)
        if not visible.any():continue
        # IMPORTANT: B3D UV convention is top-origin: v=0 maps to TOP of PNG.
        u=w0*uv[0,0]+w1*uv[1,0]+w2*uv[2,0]
        v=w0*uv[0,1]+w1*uv[1,1]+w2*uv[2,1]
        u_idx=np.clip(np.floor(u*tex.shape[1]).astype(np.int32),0,tex.shape[1]-1)
        v_idx=np.clip(np.floor(v*tex.shape[0]).astype(np.int32),0,tex.shape[0]-1)
        sampled=tex[v_idx,u_idx]
        visible&=(sampled[:,:,3]>0)
        if not visible.any():continue
        roi_z[visible]=z[visible]
        roi=rgba[y0:y1+1,x0:x1+1]
        roi[visible]=sampled[visible]
        draw_count += int(np.count_nonzero(visible))
    return Image.fromarray(rgba,'RGBA'),dict(visible_faces=int(selected.sum()),excluded_faces=int((~selected).sum()),sampled_fragments=draw_count)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model',required=True)
    p.add_argument('--texture',required=True)
    p.add_argument('--output',required=True)
    p.add_argument('--yaw',type=float,default=35)
    p.add_argument('--pitch',type=float,default=17)
    p.add_argument('--size',type=int,default=600)
    p.add_argument('--include-props',action='store_true')
    p.add_argument('--include-saddle',action='store_true')
    a=p.parse_args()
    mesh=load_mesh(a.model)
    im,report=render(mesh,Image.open(a.texture),width=a.size,height=a.size,yaw=a.yaw,pitch=a.pitch,
                     include_props=a.include_props,include_saddle=a.include_saddle)
    Path(a.output).parent.mkdir(exist_ok=True,parents=True)
    im.save(a.output)
    report.update(model=a.model,texture=a.texture,output=a.output,uv_orientation='top-origin',mode='ortho')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    main()
