cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

file(GLOB rnoh_splash_screen2_SRC CONFIGURE_DEPENDS *.cpp)
add_library(rnoh_splash_screen2 SHARED ${rnoh_splash_screen2_SRC})
target_include_directories(rnoh_splash_screen2 PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(rnoh_splash_screen2 PUBLIC rnoh)
