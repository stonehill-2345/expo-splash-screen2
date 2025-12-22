import { AppRegistry } from 'react-native'
import { SplashScreenView } from './SplashScreenView'

// Register and run splash screen
const rootTag = document.getElementById('root')
if (rootTag) {
  AppRegistry.registerComponent('main', () => SplashScreenView)
  AppRegistry.runApplication('main', { rootTag })
}

export default SplashScreenView
