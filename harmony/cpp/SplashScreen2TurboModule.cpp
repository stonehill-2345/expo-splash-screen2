/**
 * SplashScreen2 TurboModule for HarmonyOS (C++ Implementation)
 * 通过 ArkTSTurboModule 转发 JS 调用到 ArkTS 实现：
 * - preventAutoHideAsync / hideAsync：返回 Promise，用 callAsync
 * - setAutoHideAsync：同步，用 call
 */

#include "SplashScreen2TurboModule.h"
#include "RNOH/ArkTSTurboModule.h"

using namespace rnoh;
using namespace facebook;

static jsi::Value _hostFunction_SplashScreen2_preventAutoHideAsync(
    jsi::Runtime &rt,
    react::TurboModule &turboModule,
    const jsi::Value* args,
    size_t count)
{
    return static_cast<ArkTSTurboModule &>(turboModule).callAsync(rt, "preventAutoHideAsync", args, count);
}

static jsi::Value _hostFunction_SplashScreen2_hideAsync(
    jsi::Runtime &rt,
    react::TurboModule &turboModule,
    const jsi::Value* args,
    size_t count)
{
    return static_cast<ArkTSTurboModule &>(turboModule).callAsync(rt, "hideAsync", args, count);
}

static jsi::Value _hostFunction_SplashScreen2_setAutoHideAsync(
    jsi::Runtime &rt,
    react::TurboModule &turboModule,
    const jsi::Value* args,
    size_t count)
{
    return static_cast<ArkTSTurboModule &>(turboModule).call(rt, "setAutoHideAsync", args, count);
}

SplashScreen2TurboModule::SplashScreen2TurboModule(
    const ArkTSTurboModule::Context ctx,
    const std::string name)
    : ArkTSTurboModule(ctx, name)
{
    methodMap_["preventAutoHideAsync"] = MethodMetadata{0, _hostFunction_SplashScreen2_preventAutoHideAsync};
    methodMap_["hideAsync"] = MethodMetadata{0, _hostFunction_SplashScreen2_hideAsync};
    methodMap_["setAutoHideAsync"] = MethodMetadata{1, _hostFunction_SplashScreen2_setAutoHideAsync};
}
