#include <irrlicht/irrlicht.h>
#include <iostream>
using namespace irr;
using namespace scene;
int main(int argc,char**argv){
  if(argc<2)return 2;
  IrrlichtDevice* dev=createDevice(video::EDT_NULL);
  if(!dev)return 3;
  IAnimatedMesh* mesh=dev->getSceneManager()->getMesh(argv[1]);
  if(!mesh){dev->drop();return 4;}
  std::cout << "{\"slots\":[";
  for(u32 i=0;i<mesh->getMeshBufferCount();++i){
    if(i)std::cout<<",";
    std::cout << mesh->getTextureSlot(i);
  }
  std::cout << "]}\n";
  dev->drop();return 0;
}
