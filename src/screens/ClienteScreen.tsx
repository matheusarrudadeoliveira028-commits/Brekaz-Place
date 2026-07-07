import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../../supabase';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

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

  // ==========================================
  // BUSCA DE DADOS MÚLTIPLOS (Usuário e Apps)
  // ==========================================
  async function carregarDadosIniciais() {
    setCarregando(true);
    
    // 1. Descobre quem está logado
    const { data: userData } = await supabase.auth.getUser();
    const emailUsuario = userData.user?.email || '';
    setEmailLogado(emailUsuario);

    if (emailUsuario) {
      // 2. Busca os dados de faturamento/avisos dessa empresa
      const { data: empData } = await supabase
        .from('empresas')
        .select('*')
        .eq('email', emailUsuario)
        .single();
        
      if (empData) setDadosEmpresa(empData);

      // 3. Busca apenas os Apps que são "Todas" ou específicos dessa empresa
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
  // LÓGICA DE DOWNLOAD
  // ==========================================
  async function baixarEInstalar(app: AppData) {
    setStatusDownload(prev => ({ ...prev, [app.id]: 'Baixando' }));
    setProgressoDownload(prev => ({ ...prev, [app.id]: 0 }));

    try {
      const localDoArquivo = FileSystem.documentDirectory + `${app.pacote}.apk`;

      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        app.url_download, localDoArquivo, {},
        (progress) => {
          const porcentagem = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          setProgressoDownload(prev => ({ ...prev, [app.id]: porcentagem }));
        }
      );

      const resultado = await downloadResumable.downloadAsync();

      if (resultado) {
        setStatusDownload(prev => ({ ...prev, [app.id]: 'Instalando' }));
        const contentUri = await FileSystem.getContentUriAsync(resultado.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri, flags: 1, type: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      Alert.alert('Falha', `Não foi possível atualizar o ${app.nome}.`);
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
          {/* CABEÇALHO COM LOGOUT */}
          <View style={styles.headerTopo}>
            <Text style={styles.textoContaLogada}>Empresa: {emailLogado}</Text>
            <TouchableOpacity onPress={fazerLogout}>
              <Text style={styles.textoLogout}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20, paddingBottom: 0 }}>
            {/* 📢 MURAL DE AVISOS */}
            {dadosEmpresa?.aviso_mural && (
              <View style={styles.cardAviso}>
                <Text style={styles.tituloAviso}>📢 Mural de Avisos</Text>
                <Text style={styles.textoAviso}>{dadosEmpresa.aviso_mural}</Text>
              </View>
            )}

            {/* 💼 PAINEL DE ASSINATURA E CREDENCIAIS */}
            <View style={styles.cardAssinatura}>
              <Text style={styles.tituloSecaoApp}>Dados do seu Plano</Text>
              
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

              <View style={styles.linhaDivisoria} />

              <Text style={styles.labelPlano}>🔑 Credenciais Padrão do Sistema</Text>
              <Text style={styles.valorSenha}>{dadosEmpresa?.senhas_sistema}</Text>
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
                {estaBaixando ? 'Aguarde...' : estaInstalando ? 'Instalando...' : 'Atualizar Sistema'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

// ESTILOS DEIXADOS COM CARA DE SISTEMA CARO
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  containerCentralizado: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  textoCarregando: { marginTop: 10, color: '#64748b' },
  
  // Header Topo
  headerTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  textoContaLogada: { color: '#475569', fontSize: 13, fontWeight: '600' },
  textoLogout: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },

  // Card Aviso
  cardAviso: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', padding: 15, borderRadius: 12, marginBottom: 15 },
  tituloAviso: { color: '#d97706', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  textoAviso: { color: '#92400e', fontSize: 14, lineHeight: 20 },

  // Card Assinatura
  cardAssinatura: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 20, elevation: 4 },
  tituloSecaoApp: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  linhaInfoPlano: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  labelPlano: { color: '#94a3b8', fontSize: 12, marginBottom: 2 },
  valorPlanoDestaque: { color: '#10b981', fontSize: 16, fontWeight: 'bold' },
  valorPlano: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  linhaDivisoria: { height: 1, backgroundColor: '#334155', marginVertical: 15 },
  valorSenha: { color: '#f8fafc', fontSize: 14, marginTop: 5, backgroundColor: '#0f172a', padding: 10, borderRadius: 8, overflow: 'hidden' },

  // Card App
  cardApp: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  cardAppHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  nomeApp: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  pacoteApp: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badgeData: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  textoBadgeData: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
  descricaoApp: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  tamanhoText: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },

  // Botão e Progresso
  botaoAcao: { backgroundColor: '#0052cc', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  botaoDesabilitado: { backgroundColor: '#94a3b8' },
  textoBotao: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  containerProgresso: { marginBottom: 16 },
  barraFundo: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barraPreenchimento: { height: '100%', backgroundColor: '#10b981' },
  textoPorcentagem: { fontSize: 12, color: '#10b981', fontWeight: 'bold', textAlign: 'right' }
});