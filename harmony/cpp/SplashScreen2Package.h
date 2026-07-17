/**
 * SplashScreen2 Package for HarmonyOS (C++ Header)
 * 注册 SplashScreen2 TurboModule（模块名 'ExpoSplashHtml'，与包 JS 入口 requireOptionalNativeModule('ExpoSplashHtml') 对齐）。
 */

#ifndef SPLASH_SCREEN2_PACKAGE_H
#define SPLASH_SCREEN2_PACKAGE_H

#include "RNOH/Package.h"
#include "SplashScreen2TurboModule.h"

using namespace rnoh;
using namespace facebook;

class SplashScreen2TurboModuleFactoryDelegate : public TurboModuleFactoryDelegate {
public:
    SharedTurboModule createTurboModule(Context ctx, const std::string &name) const override
    {
        if (name == "ExpoSplashHtml") {
            return std::make_shared<SplashScreen2TurboModule>(ctx, name);
        }
        return nullptr;
    };
};

namespace rnoh {

class SplashScreen2Package : public Package {
public:
    SplashScreen2Package(Package::Context ctx) : Package(ctx) {}

    std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate() override
    {
        return std::make_unique<SplashScreen2TurboModuleFactoryDelegate>();
    }
};
} // namespace rnoh

#endif
