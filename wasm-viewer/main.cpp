#include <irrlicht.h>
#include <emscripten.h>
#include <SDL.h>
#include <string>
using namespace irr;
using namespace core;
using namespace scene;
using namespace video;

static IrrlichtDevice *device=nullptr;
static IVideoDriver *driver=nullptr;
static ISceneManager *smgr=nullptr;
static IAnimatedMeshSceneNode *node=nullptr;
static ICameraSceneNode *camera=nullptr;

static void frame(){
  if(!device || !driver || !smgr) return;
  device->run();
  driver->beginScene(true,true,SColor(255,9,11,14));
  smgr->drawAll();
  driver->endScene();
}
static void fit(){
  if(!node||!camera)return;
  aabbox3df box=node->getBoundingBox();
  vector3df ext=box.getExtent(), ctr=box.getCenter();
  float m=core::max_(ext.X,core::max_(ext.Y,ext.Z)); if(m<0.01f)m=1.f;
  node->setPosition(-ctr);
  camera->setPosition(vector3df(0,0,-m*2.2f));
  camera->setTarget(vector3df(0,0,0));
}
extern "C" {
EMSCRIPTEN_KEEPALIVE int viewer_load(const char *path){
  if(!smgr)return 0;
  if(node){node->remove();node=nullptr;}
  IAnimatedMesh *mesh=smgr->getMesh(path);
  if(!mesh)return 0;
  node=smgr->addAnimatedMeshSceneNode(mesh);
  if(!node)return 0;
  node->setMaterialFlag(EMF_LIGHTING,false);
  node->setMaterialType(EMT_TRANSPARENT_ALPHA_CHANNEL_REF);
  fit(); return 1;
}
EMSCRIPTEN_KEEPALIVE int viewer_texture(const char *path){
  if(!node||!driver)return 0;
  ITexture *t=driver->getTexture(path); if(!t)return 0;
  if(node->getMaterialCount()>0) node->setMaterialTexture(0,t);
  for(u32 i=1;i<node->getMaterialCount();++i) node->getMaterial(i).MaterialType=EMT_TRANSPARENT_ALPHA_CHANNEL;
  return 1;
}
EMSCRIPTEN_KEEPALIVE void viewer_animation(int a,int b,float fps){
  if(!node)return; node->setFrameLoop(a,b); node->setAnimationSpeed(fps);
}
EMSCRIPTEN_KEEPALIVE void viewer_resize(int w,int h){
  if(driver)driver->OnResize(dimension2du(w,h));
  if(camera&&h>0)camera->setAspectRatio((float)w/(float)h);
}
}
int main(){
  SIrrlichtCreationParameters p;
  p.DriverType=EDT_OGLES2; p.WindowSize=dimension2du(640,640); p.Bits=24;
  p.AntiAlias=0; p.Stencilbuffer=false; p.Vsync=false;
  device=createDeviceEx(p); if(!device)return 1;
  driver=device->getVideoDriver(); smgr=device->getSceneManager();
  camera=smgr->addCameraSceneNode();
  camera->setNearValue(.01f); camera->setFarValue(10000.f);
  emscripten_set_main_loop(frame,0,1);
  return 0;
}
