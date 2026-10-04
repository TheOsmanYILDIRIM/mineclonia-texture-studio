cmake_minimum_required(VERSION 3.20)
project(irrlicht_b3d_web CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Minimal dependency target expected by IrrlichtMt's mesh loaders.
add_library(tiniergltf INTERFACE)
add_library(tiniergltf::tiniergltf ALIAS tiniergltf)
target_include_directories(tiniergltf INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/vendor/luanti/lib/tiniergltf")

# Luanti's IrrlichtMt is supplied by the workflow under vendor/luanti/irr.
add_subdirectory(vendor/luanti/irr irr-build)

add_executable(b3d_viewer main.cpp)
target_link_libraries(b3d_viewer PRIVATE IrrlichtMt::IrrlichtMt)
target_compile_options(b3d_viewer PRIVATE -O3)
target_link_options(b3d_viewer PRIVATE
  -O3
  "SHELL:-sUSE_SDL=2"
  "SHELL:-sMIN_WEBGL_VERSION=2"
  "SHELL:-sMAX_WEBGL_VERSION=2"
  "SHELL:-sALLOW_MEMORY_GROWTH=1"
  "SHELL:-sMODULARIZE=1"
  "SHELL:-sEXPORT_NAME=createB3DViewer"
  "SHELL:-sEXPORTED_RUNTIME_METHODS=['FS','ccall','cwrap']"
  "SHELL:-sEXPORTED_FUNCTIONS=['_main','_viewer_load','_viewer_texture','_viewer_animation','_viewer_resize']"
)
set_target_properties(b3d_viewer PROPERTIES SUFFIX ".js")
