import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../supabase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function fazerLogin() {
    if (!email || !senha) {
      return Alert.alert('Atenção', 'Preencha o e-mail e a senha.');
    }

    // Atalho exclusivo para você (Dono) acessar o Admin direto
    if (email.toLowerCase() === 'brekaztecnologialtda' && senha === 'Brekaz2026#') {
      return navigation.replace('Admin');
    }

    setCarregando(true);
    
    // Login real consultando o Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      Alert.alert('Acesso Negado', 'E-mail ou senha incorretos.');
    } else {
      // O 'replace' impede que o usuário volte para a tela de login apertando o botão "Voltar" do celular
      navigation.replace('Cliente');
    }
  }

  return (
    <View style={styles.container}>
      
      {/* 🚀 AQUI ESTÁ A SUA LOGO */}
      <Image 
        source={require('../../assets/icon.png')} 
        style={styles.logo} 
        resizeMode="contain"
      />

      <Text style={styles.titulo}>Brekaz Place</Text>
      <Text style={styles.subtitulo}>Acesso Corporativo</Text>

      <View style={styles.cardLogin}>
        <Text style={styles.label}>E-mail da Empresa</Text>
        <TextInput 
          style={styles.input} 
          placeholder="exemplo@empresa.com" 
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput 
          style={styles.input} 
          placeholder="••••••••" 
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity 
          style={[styles.botaoAcao, carregando && styles.botaoDesabilitado]} 
          onPress={fazerLogin}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotao}>Entrar no Sistema</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#f8fafc' },
  
  // Estilo novo para a sua logo
  logo: { width: 100, height: 100, alignSelf: 'center', marginBottom: 15 },
  
  titulo: { fontSize: 32, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 40 },
  cardLogin: { backgroundColor: '#ffffff', padding: 25, borderRadius: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 20 },
  botaoAcao: { backgroundColor: '#0052cc', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  botaoDesabilitado: { backgroundColor: '#94a3b8' },
  textoBotao: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});