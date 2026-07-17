/**
 * SplashScreen2 TurboModule for HarmonyOS (C++ Header)
 * JS 侧 NativeModules.SplashScreen2 的桥接入口，转发到 ArkTS 实现。
 */

#ifndef SPLASH_SCREEN2_TURBOMODULE_H
#define SPLASH_SCREEN2_TURBOMODULE_H

#include <ReactCommon/TurboModule.h>
#include "RNOH/ArkTSTurboModule.h"

namespace rnoh {

class JSI_EXPORT SplashScreen2TurboModule : public ArkTSTurboModule {
    public:
        SplashScreen2TurboModule(const ArkTSTurboModule::Context ctx, const std::string name);
};

} // namespace rnoh

#endif
