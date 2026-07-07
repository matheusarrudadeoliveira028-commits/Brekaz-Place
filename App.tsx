import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importando todas as telas do projeto
import LoginScreen from './src/screens/LoginScreen';
import ClienteScreen from './src/screens/ClienteScreen';
import AdminScreen from './src/screens/AdminScreen';
import FinanceiroScreen from './src/screens/FinanceiroScreen';
import PessoalScreen from './src/screens/PessoalScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        
        {/* Tela de Login */}
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        
        {/* Tela da Empresa Cliente (Downloads e Avisos) */}
        <Stack.Screen 
          name="Cliente" 
          component={ClienteScreen} 
          options={{ headerShown: false }} 
        />
        
        {/* Painel do Dono (Uploads e Gestão) */}
        <Stack.Screen 
          name="Admin" 
          component={AdminScreen} 
          options={{ headerShown: false }} 
        />

        {/* Dashboard Financeiro da Empresa (PJ) */}
        <Stack.Screen 
          name="Financeiro" 
          component={FinanceiroScreen} 
          options={{ headerShown: false }} 
        />

        {/* Dashboard de Fluxo de Caixa Pessoal (PF) */}
        <Stack.Screen 
          name="Pessoal" 
          component={PessoalScreen} 
          options={{ headerShown: false }} 
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}