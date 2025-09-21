import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import CreateWalletScreen from './src/screens/CreateWalletScreen';
import ImportWalletScreen from './src/screens/ImportWalletScreen';
import HomeScreen from './src/screens/HomeScreen';
import SendScreen from './src/screens/SendScreen';
import ReceiveScreen from './src/screens/ReceiveScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

// Services
import { WalletProvider } from './src/services/WalletContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main app
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'Send') {
            iconName = 'send';
          } else if (route.name === 'Receive') {
            iconName = 'qr-code';
          } else if (route.name === 'Transactions') {
            iconName = 'list';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'VLY Wallet' }}
      />
      <Tab.Screen 
        name="Send" 
        component={SendScreen} 
        options={{ title: 'Send VLY' }}
      />
      <Tab.Screen 
        name="Receive" 
        component={ReceiveScreen} 
        options={{ title: 'Receive VLY' }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsScreen} 
        options={{ title: 'Transactions' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
function App() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Welcome"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#667eea',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen 
              name="Welcome" 
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="CreateWallet" 
              component={CreateWalletScreen}
              options={{ title: 'Create Wallet' }}
            />
            <Stack.Screen 
              name="ImportWallet" 
              component={ImportWalletScreen}
              options={{ title: 'Import Wallet' }}
            />
            <Stack.Screen 
              name="Main" 
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="QRScanner" 
              component={QRScannerScreen}
              options={{ title: 'Scan QR Code' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </WalletProvider>
    </SafeAreaProvider>
  );
}

export default App;