import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { supabase } from '../../supabase';

// IMPORTAÇÕES BLINDADAS CONTRA O EXPO 54
import * as LegacyFileSystem from 'expo-file-system/legacy'; 
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing'; // <-- Nosso Plano B Nativo

type AppData = {
  id: number;
  nome: string;
  pacote: string;
  versao_texto: string;
  url_download: string;
  tamanho_mb: string;
  descricao: string;
  data_atualizacao: string;
  empresa_vinculada: string;
};

type EmpresaData = {
  email: string;
  status_conta: string;
  vencimento: string;
  aviso_mural: string;
  senhas_sistema: string;
};

export default function ClienteScreen({ navigation }: any) {
  const [sistemas, setSistemas] = useState<AppData[]>([]);
  const [dadosEmpresa, setDadosEmpresa] = useState<EmpresaData | null>(null);
  const [emailLogado, setEmailLogado] = useState('');
  
  const [carregando, setCarregando] = useState(true);
  const [statusDownload, setStatusDownload] = useState<{ [key: number]: string }>({});
  const [progressoDownload, setProgressoDownload] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  async function carregarDadosIniciais() {
    setCarregando(true);
    
    const { data: userData } = await supabase.auth.getUser();
    const emailUsuario = userData.user?.email || '';
    setEmailLogado(emailUsuario);

    if (emailUsuario) {
      const { data: empData } = await supabase
        .from('empresas')
        .select('*')
        .eq('email', emailUsuario)
        .single();
        
      if (empData) setDadosEmpresa(empData);

      const { data: appsData, error } = await supabase
        .from('catalogo_apps')
        .select('*')
        .or(`empresa_vinculada.eq.Todas,empresa_vinculada.eq.${emailUsuario}`)
        .order('id', { ascending: false });

      if (!error && appsData) setSistemas(appsData);
    }
    
    setCarregando(false);
  }

  // ==========================================
  // LÓGICA DE DOWNLOAD 100% BLINDADA
  // ==========================================
  async function baixarEInstalar(app: AppData) {
    setStatusDownload(prev => ({ ...prev, [app.id]: 'Baixando' }));
    setProgressoDownload(prev => ({ ...prev, [app.id]: 0 }));

    try {
      const localDoArquivo = LegacyFileSystem.documentDirectory + `${app.pacote}.apk`;

      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        app.url_download, 
        localDoArquivo, 
        {},
        (progress) => {
          const porcentagem = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          setProgressoDownload(prev => ({ ...prev, [app.id]: porcentagem }));
        }
      );

      const resultado = await downloadResumable.downloadAsync();

      if (resultado) {
        setStatusDownload(prev => ({ ...prev, [app.id]: 'Instalando' }));
        
        try {
          // PLANO A: Tenta a conversão clássica do Android
          const contentUri = await LegacyFileSystem.getContentUriAsync(resultado.uri);
          
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri, 
            flags: 1, 
            type: 'application/vnd.android.package-archive',
          });
          
        } catch (expoError) {
          // PLANO B: Se o Expo 54 bloquear a URI nativa, usamos o Compartilhamento Nativo!
          await Sharing.shareAsync(resultado.uri, {
            mimeType: 'application/vnd.android.package-archive',
            dialogTitle: 'Instalar Atualização',
          });
        }
      }
    } catch (error) {
      Alert.alert('Falha', `Não foi possível baixar o ${app.nome}. Verifique a internet.`);
      console.log("Erro no download: ", error);
    } finally {
      setStatusDownload(prev => ({ ...prev, [app.id]: '' }));
    }
  }

  async function fazerLogout() {
    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  if (carregando) {
    return (
      <View style={styles.containerCentralizado}>
        <ActivityIndicator size="large" color="#0052cc" />
        <Text style={styles.textoCarregando}>Autenticando e buscando dados...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={sistemas}
      keyExtractor={(item) => item.id.toString()}
      refreshing={carregando}
      onRefresh={carregarDadosIniciais}
      ListHeaderComponent={() => (
        <View>
          <View style={styles.headerTopo}>
            <Text style={styles.textoContaLogada}>Empresa: {emailLogado}</Text>
            <TouchableOpacity onPress={fazerLogout}>
              <Text style={styles.textoLogout}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20, paddingBottom: 0 }}>
            {dadosEmpresa?.aviso_mural && (
              <View style={styles.cardAviso}>
                <Text style={styles.tituloAviso}>📢 Mural de Avisos</Text>
                <Text style={styles.textoAviso}>{dadosEmpresa.aviso_mural}</Text>
              </View>
            )}

            {/* CARD DE ASSINATURA REFORMULADO (VISUAL PREMIUM E CLARO) */}
            <View style={styles.cardAssinaturaPremium}>
              <View style={styles.headerCardAssinatura}>
                <Text style={styles.tituloSecaoApp}>💼 Dados do seu Plano</Text>
              </View>
              
              <View style={styles.linhaInfoPlano}>
                <View>
                  <Text style={styles.labelPlano}>Status da Conta</Text>
                  <Text style={styles.valorPlanoDestaque}>{dadosEmpresa?.status_conta}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.labelPlano}>Ciclo / Vencimento</Text>
                  <Text style={styles.valorPlano}>{dadosEmpresa?.vencimento}</Text>
                </View>
              </View>

              <View style={styles.linhaDivisoriaClara} />

              <Text style={styles.labelPlanoDestaque}>🔑 Credenciais Padrão do Sistema</Text>
              <View style={styles.caixaSenha}>
                <Text style={styles.valorSenhaClaro}>{dadosEmpresa?.senhas_sistema}</Text>
              </View>
            </View>

            <Text style={[styles.tituloSecaoApp, { marginTop: 10, marginBottom: 15 }]}>
              ⬇️ Sistemas Disponíveis
            </Text>
          </View>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item }) => {
        const estaBaixando = statusDownload[item.id] === 'Baixando';
        const estaInstalando = statusDownload[item.id] === 'Instalando';
        const porcentagem = Math.round((progressoDownload[item.id] || 0) * 100);

        return (
          <View style={styles.cardApp}>
            <View style={styles.cardAppHeader}>
              <View>
                <Text style={styles.nomeApp}>{item.nome}</Text>
                <Text style={styles.pacoteApp}>Versão: {item.versao_texto}</Text>
              </View>
              <View style={styles.badgeData}>
                <Text style={styles.textoBadgeData}>{item.data_atualizacao}</Text>
              </View>
            </View>

            <Text style={styles.descricaoApp}>{item.descricao}</Text>
            <Text style={styles.tamanhoText}>Tamanho: {item.tamanho_mb}</Text>

            {estaBaixando && (
              <View style={styles.containerProgresso}>
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchimento, { width: `${porcentagem}%` }]} />
                </View>
                <Text style={styles.textoPorcentagem}>Baixando... {porcentagem}%</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.botaoAcao, (estaBaixando || estaInstalando) && styles.botaoDesabilitado]}
              onPress={() => baixarEInstalar(item)}
              disabled={estaBaixando || estaInstalando}
            >
              <Text style={styles.textoBotao}>
                {estaBaixando ? 'Aguarde...' : estaInstalando ? 'Instalando...' : 'Baixar e Instalar'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  containerCentralizado: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  textoCarregando: { marginTop: 10, color: '#64748b' },
  headerTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  textoContaLogada: { color: '#475569', fontSize: 13, fontWeight: '600' },
  textoLogout: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  
  cardAviso: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', padding: 15, borderRadius: 12, marginBottom: 15 },
  tituloAviso: { color: '#d97706', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  textoAviso: { color: '#92400e', fontSize: 14, lineHeight: 20 },
  
  // NOVOS ESTILOS DO CARD DE ASSINATURA PREMIUM
  cardAssinaturaPremium: { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 5, borderTopColor: '#0052cc', overflow: 'hidden' },
  headerCardAssinatura: { backgroundColor: '#f8fafc', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tituloSecaoApp: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  linhaInfoPlano: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 15 },
  labelPlano: { color: '#64748b', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  valorPlanoDestaque: { color: '#059669', fontSize: 17, fontWeight: '900' },
  valorPlano: { color: '#1e293b', fontSize: 17, fontWeight: '800' },
  linhaDivisoriaClara: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15, marginHorizontal: 20 },
  labelPlanoDestaque: { color: '#475569', fontSize: 13, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 8 },
  caixaSenha: { backgroundColor: '#f8fafc', marginHorizontal: 20, marginBottom: 20, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  valorSenhaClaro: { color: '#334155', fontSize: 14, fontWeight: '500', lineHeight: 22 },

  // Estilos do Card de Apps
  cardApp: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  cardAppHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  nomeApp: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  pacoteApp: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badgeData: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  textoBadgeData: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
  descricaoApp: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  tamanhoText: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  botaoAcao: { backgroundColor: '#0052cc', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  botaoDesabilitado: { backgroundColor: '#94a3b8' },
  textoBotao: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  containerProgresso: { marginBottom: 16 },
  barraFundo: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barraPreenchimento: { height: '100%', backgroundColor: '#10b981' },
  textoPorcentagem: { fontSize: 12, color: '#10b981', fontWeight: 'bold', textAlign: 'right' }
});