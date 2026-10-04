#include <irrlicht/irrlicht.h>
#include <fstream>
#include <iostream>
#include <string>
using namespace irr;
using namespace scene;
using namespace video;

static void writeVertex(std::ofstream &o, const S3DVertex &v) {
  o << "v " << v.Pos.X << " " << v.Pos.Y << " " << v.Pos.Z << "\n";
  o << "vt " << v.TCoords.X << " " << (1.0f - v.TCoords.Y) << "\n";
}
int main(int argc,char**argv){
  if(argc<4){std::cerr<<"usage: bake_b3d_preview input.b3d output.obj frame\n";return 2;}
  IrrlichtDevice* dev=createDevice(EDT_NULL);
  if(!dev){std::cerr<<"irrlicht device failed\n";return 3;}
  IAnimatedMesh* anim=dev->getSceneManager()->getMesh(argv[1]);
  if(!anim){std::cerr<<"B3D load failed\n";dev->drop();return 4;}
  float frame=std::stof(argv[3]);
  IMesh* mesh=anim->getMesh(frame,255,-1,-1);
  if(!mesh){std::cerr<<"frame mesh failed\n";dev->drop();return 5;}
  std::ofstream out(argv[2]);
  size_t base=1;
  for(u32 b=0;b<mesh->getMeshBufferCount();++b){
    IMeshBuffer* mb=mesh->getMeshBuffer(b);
    out << "g material_" << b << "\\n";
    out << "usemtl material_" << b << "\\n";
    const u32 vc=mb->getVertexCount();
    const E_VERTEX_TYPE type=mb->getVertexType();
    for(u32 i=0;i<vc;++i){
      if(type==EVT_STANDARD) writeVertex(out,((S3DVertex*)mb->getVertices())[i]);
      else if(type==EVT_2TCOORDS){auto &v=((S3DVertex2TCoords*)mb->getVertices())[i];S3DVertex x(v.Pos,v.Normal,v.Color,v.TCoords);writeVertex(out,x);}
      else {auto &v=((S3DVertexTangents*)mb->getVertices())[i];S3DVertex x(v.Pos,v.Normal,v.Color,v.TCoords);writeVertex(out,x);}
    }
    const u16* idx=mb->getIndices();
    for(u32 i=0;i+2<mb->getIndexCount();i+=3){
      size_t a=base+idx[i],c=base+idx[i+1],d=base+idx[i+2];
      out<<"f "<<a<<"/"<<a<<" "<<c<<"/"<<c<<" "<<d<<"/"<<d<<"\n";
    }
    base+=vc;
  }
  std::cerr<<"baked buffers="<<mesh->getMeshBufferCount()<<" vertices="<<(base-1)<<" frame="<<frame<<"\n";
  dev->drop(); return 0;
}
