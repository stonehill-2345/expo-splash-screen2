import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Image, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
} from 'react-native';

import topImage from './images/top.png';
import bottomImage from './images/bottom.png';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedImage = Animated.createAnimatedComponent(Image);

export const SplashScreenView = () => {
  const [showModal, setShowModal] = useState(false);
  const modalOpacity = useRef(new Animated.Value(1)).current;
  // Bottom image animation values
  const bottomImageOpacity = useRef(new Animated.Value(0)).current;
  const bottomImageScale = useRef(new Animated.Value(0.8)).current;
  const bottomImageTranslateY = useRef(new Animated.Value(30)).current;
  const bottomImageFloatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Expose global functions for native code to call
    (window as any).showPrivacyDialog = () => {
      console.log('[App] showPrivacyDialog called');
      modalOpacity.setValue(1);
      setShowModal(true);
    };

    (window as any).hidePrivacyDialog = () => {
      console.log('[App] hidePrivacyDialog called');
      // Play fade-out animation first
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Hide dialog after animation ends
        setShowModal(false);
        modalOpacity.setValue(1); // Reset opacity for next display
      });
    };

    // Check isAuth state and show/hide dialog
    (window as any).checkAuthStatus = () => {
      const isAuth = (window as any).isAuth;
      console.log('[App] checkAuthStatus called, isAuth:', isAuth);
      if (isAuth) {
        modalOpacity.setValue(1);
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowModal(false);
          modalOpacity.setValue(1);
        });
      } else {
        modalOpacity.setValue(1);
        setShowModal(true);
      }
    };

    // After page loads, check isAuth state
    // Detect if in native environment (by checking if native-injected objects exist)
    const isNativeEnv = !!(window as any).Android || !!(window as any).webkit?.messageHandlers;
    let checkAuthTimeout: NodeJS.Timeout | null = null;

    if (isNativeEnv) {
      // Native environment: wait for isAuth injection (max 5 seconds)
      let checkCount = 0;
      const MAX_CHECK_COUNT = 50; // Max 50 checks (5 seconds)

      const checkAuth = () => {
        const isAuth = (window as any).isAuth;
        if (isAuth !== undefined) {
          console.log('[App] isAuth is defined:', isAuth);
          (window as any).checkAuthStatus();
          checkAuthTimeout = null;
        } else {
          checkCount++;
          if (checkCount < MAX_CHECK_COUNT) {
            // Only check in native environment, reduce log output (output every 10 times)
            if (checkCount % 10 === 0) {
              console.log(`[App] Waiting for isAuth... (${checkCount}/${MAX_CHECK_COUNT})`);
            }
            checkAuthTimeout = setTimeout(checkAuth, 100) as any;
          } else {
            console.log('[App] isAuth not defined after max checks');
            modalOpacity.setValue(1);
            setShowModal(true);
          }
        }
      };

      // Check immediately once
      checkAuth();
    } else {
      // Browser development environment: directly show dialog, don't check isAuth
      console.log('[App] Development mode detected, showing privacy dialog');
      modalOpacity.setValue(1);
      setShowModal(true);
    }

    // Also listen for changes to window.isAuth (if native code updates it)
    const intervalId = setInterval(() => {
      const isAuth = (window as any).isAuth;
      if (isAuth !== undefined && !showModal && !isAuth) {
        // If isAuth is set to false, show dialog
        console.log('[App] isAuth changed to false, showing dialog');
        modalOpacity.setValue(1);
        setShowModal(true);
      }
    }, 200);

    // Bottom image entrance animation: fade in + scale up + slide up
    Animated.parallel([
      Animated.timing(bottomImageOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(bottomImageScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(bottomImageTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous floating animation
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bottomImageFloatY, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(bottomImageFloatY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    
    // Start floating animation after entrance animation completes
    setTimeout(() => {
      floatingAnimation.start();
    }, 800);

    return () => {
      if (checkAuthTimeout) {
        clearTimeout(checkAuthTimeout);
      }
      clearInterval(intervalId);
      floatingAnimation.stop();
    };
  }, []); // Remove showModal dependency to avoid repeated execution

  const handleAgreePrivacyPolicy = () => {
    console.log('User agreed to privacy policy');
    // Play fade-out animation first
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowModal(false);
      modalOpacity.setValue(1);
    });

    // iOS WebKit message handling
    if (
      (window as any).webkit &&
      (window as any).webkit.messageHandlers &&
      (window as any).webkit.messageHandlers.agreePrivacyPolicy
    ) {
      (window as any).webkit.messageHandlers.agreePrivacyPolicy.postMessage('agree');
    }
    // Android JavaScript interface
    else if ((window as any).Android && (window as any).Android.agreePrivacyPolicy) {
      (window as any).Android.agreePrivacyPolicy();
    }
  };

  const handleDisagreePrivacyPolicy = () => {
    console.log('User disagreed to privacy policy');

    // iOS WebKit message handling
    if (
      (window as any).webkit &&
      (window as any).webkit.messageHandlers &&
      (window as any).webkit.messageHandlers.disagreePrivacyPolicy
    ) {
      (window as any).webkit.messageHandlers.disagreePrivacyPolicy.postMessage('disagree');
    }
    // Android JavaScript interface
    else if ((window as any).Android && (window as any).Android.disagreePrivacyPolicy) {
      (window as any).Android.disagreePrivacyPolicy();
    }
  };

  const handleOpenPrivacyPolicy = (url: string) => {
    console.log('Agreement', url);
    // iOS WebKit message handling
    if (
      (window as any).webkit &&
      (window as any).webkit.messageHandlers &&
      (window as any).webkit.messageHandlers.openPrivacyPolicy
    ) {
      (window as any).webkit.messageHandlers.openPrivacyPolicy.postMessage(url);
    }
    // Android JavaScript interface
    else if ((window as any).Android && (window as any).Android.openPrivacyPolicy) {
      (window as any).Android.openPrivacyPolicy(url);
    }
  };


  return (
    <View style={styles.container}>
      <Image 
        source={topImage} 
        style={styles.topImage}
        resizeMode="contain"
      />
     
      <AnimatedImage 
        source={bottomImage}
        style={[
          styles.bottomImage,
          {
            opacity: bottomImageOpacity,
            transform: [
              { scale: bottomImageScale },
              { translateY: Animated.add(bottomImageTranslateY, bottomImageFloatY) },
            ],
          },
        ]}
        resizeMode="contain"
      />

      {/* User agreement modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >

        	
			<AnimatedView 
          style={[
            styles.modalOverlay,
            {
              opacity: modalOpacity,
            }
          ]}
        >

          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              温馨提示
            </Text>
            <Text style={styles.modalText}>
              感谢您使用"XXX"！我们非常重视您的个人信息保护。在使用我们的服务前，请您仔细阅读并充分理解
              <Text
                style={styles.linkText}
                onPress={() => handleOpenPrivacyPolicy('https://www.baidu.com/')}
              >
                《隐私政策》
              </Text>
              、
              <Text
                style={styles.linkText}
                onPress={() => handleOpenPrivacyPolicy('https://www.baidu.com/')}
              >
                《用户协议》
              </Text>
              与
              <Text
                style={styles.linkText}
                onPress={() => handleOpenPrivacyPolicy('https://www.baidu.com/')}
              >
                《未成年人个人信息保护协议》
              </Text>
              的全部内容。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonDisagree]}
                onPress={handleDisagreePrivacyPolicy}
                activeOpacity={0.7}
              >

               

                <Text style={styles.buttonTextDisagree}>不同意</Text>
              </TouchableOpacity>

              

              <TouchableOpacity
                style={[styles.button, styles.buttonAgree]}
                onPress={handleAgreePrivacyPolicy}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonTextAgree}>同意</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#10021F',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topImage: {
    width: '100%',
    height:153
  },
  centerImage: {
    width: 162,
    height: 143
  },
  bottomImage: {
    width: '100%',
    height: 214
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#3B0C70',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
    textAlign: 'left',
    marginBottom: 24,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius:28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisagree: {
    
    borderWidth: 1,
    borderColor: '#fff',
    paddingVertical: 12,
    
  },
  buttonAgree: {
   borderWidth: 1,
    borderColor: '#fff',
    paddingVertical: 12,
  },
  buttonTextDisagree: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  buttonTextAgree: {
     fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});
