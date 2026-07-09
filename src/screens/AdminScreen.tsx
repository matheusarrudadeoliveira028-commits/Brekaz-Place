import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, FlatList, Modal, ActivityIndicator } from 'react-native';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';

type AppData = {
  id: number;
  nome: string;
  pacote: string;
  versao_texto: string;
  versao_codigo: number;
  descricao: string;
  empresa_vinculada: string;
  qtd_downloads: number; // NOVO DADO DE RASTREIO
};

type EmpresaData = {
  id: number;
  email: string;
  status_conta: string;
  vencimento: string;
  aviso_mural: string;
  senhas_sistema: string;
  valor_mensalidade: string;
};

export default function AdminScreen({ navigation }: any) {
  const [abaAtual, setAbaAtual] = useState<'upload' | 'gerenciar' | 'empresas'>('upload');

  const [empresasCadastradas, setEmpresasCadastradas] = useState<string[]>(['Todas']);
  const [empresasListaCompleta, setEmpresasListaCompleta] = useState<EmpresaData[]>([]);

  const [upNome, setUpNome] = useState('');
  const [upPacote, setUpPacote] = useState('');
  const [upVersaoTexto, setUpVersaoTexto] = useState('');
  const [upVersaoCodigo, setUpVersaoCodigo] = useState('');
  const [upDescricao, setUpDescricao] = useState('');
  const [upEmpresa, setUpEmpresa] = useState('Todas');
  const [fazendoUpload, setFazendoUpload] = useState(false);
  const [modalUploadEmpresaVisivel, setModalUploadEmpresaVisivel] = useState(false);

  const [sistemas, setSistemas] = useState<AppData[]>([]);
  const [carregandoListagem, setCarregandoListagem] = useState(false);
  const [modalEdicaoVisivel, setModalEdicaoVisivel] = useState(false);
  const [appEditando, setAppEditando] = useState<AppData | null>(null);
  const [modalEditEmpresaVisivel, setModalEditEmpresaVisivel] = useState(false);

  const [empEmail, setEmpEmail] = useState('');
  const [empSenha, setEmpSenha] = useState('');
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [modalEdicaoEmpresaVisivel, setModalEdicaoEmpresaVisivel] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaData | null>(null);

  useEffect(() => {
    carregarEmpresas();
    if (abaAtual === 'gerenciar') buscarSistemasAdmin();
  }, [abaAtual]);

  async function carregarEmpresas() {
    const { data, error } = await supabase.from('empresas').select('*').order('email');
    if (!error && data) {
      setEmpresasListaCompleta(data);
      setEmpresasCadastradas(['Todas', ...data.map(emp => emp.email)]);
    }
  }

  async function selecionarESubirApk() {
    if (!upNome || !upPacote || !upVersaoCodigo || !upVersaoTexto) return Alert.alert('Atenção', 'Preencha os campos obrigatórios.');
    
    try {
      const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/vnd.android.package-archive', copyToCacheDirectory: true });
      if (resultado.canceled) return;

      setFazendoUpload(true);
      const arquivo = resultado.assets[0];
      const tamanhoMegaBytes = (arquivo.size || 0) / (1024 * 1024);
      const stringTamanho = `${tamanhoMegaBytes.toFixed(1)} MB`;
      const nomeArquivoStorage = `${upPacote}_v${upVersaoCodigo}_${Date.now()}.apk`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || supabaseAnonKey;
      
      const uploadUrl = `${supabaseUrl}/storage/v1/object/apks/${nomeArquivoStorage}`;

      const uploadResult = await LegacyFileSystem.uploadAsync(uploadUrl, arquivo.uri, {
        httpMethod: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey, 'Content-Type': 'application/vnd.android.package-archive' }
      });

      if (uploadResult.status !== 200) throw new Error('Falha no envio.');

      const { data: urlData } = supabase.storage.from('apks').getPublicUrl(nomeArquivoStorage);
      const dataHoje = new Date().toLocaleDateString('pt-BR');

      const { error: dbError } = await supabase.from('catalogo_apps').insert({
        nome: upNome, pacote: upPacote, versao_texto: upVersaoTexto, versao_codigo: parseInt(upVersaoCodigo),
        descricao: upDescricao, tamanho_mb: stringTamanho, url_download: urlData.publicUrl, data_atualizacao: dataHoje, empresa_vinculada: upEmpresa,
        qtd_downloads: 0
      });
      if (dbError) throw dbError;

      Alert.alert('Sucesso!', 'Seu aplicativo foi publicado!');
      setUpNome(''); setUpPacote(''); setUpVersaoTexto(''); setUpVersaoCodigo(''); setUpDescricao(''); setUpEmpresa('Todas');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar o arquivo.');
    } finally {
      setFazendoUpload(false);
    }
  }

  async function buscarSistemasAdmin() {
    setCarregandoListagem(true);
    const { data, error } = await supabase.from('catalogo_apps').select('*').order('id', { ascending: false });
    if (!error && data) setSistemas(data);
    setCarregandoListagem(false);
  }

  async function salvarEdicaoApp() {
    if (!appEditando) return;
    const { error } = await supabase.from('catalogo_apps').update({
      nome: appEditando.nome, descricao: appEditando.descricao, versao_texto: appEditando.versao_texto, empresa_vinculada: appEditando.empresa_vinculada
    }).eq('id', appEditando.id);
    if (!error) { Alert.alert('Sucesso', 'Atualizado!'); setModalEdicaoVisivel(false); buscarSistemasAdmin(); }
  }

  async function excluirApp(id: number) {
    Alert.alert('Confirmar', 'Apagar?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: async () => { await supabase.from('catalogo_apps').delete().eq('id', id); buscarSistemasAdmin(); } }]);
  }

  async function cadastrarNovaEmpresa() {
    if (!empEmail || !empSenha) return Alert.alert('Atenção', 'Preencha o e-mail e a senha.');
    setCriandoEmpresa(true);
    const emailTratado = empEmail.trim().toLowerCase();
    const { error: authError } = await supabase.auth.signUp({ email: emailTratado, password: empSenha });
    await supabase.auth.signOut();
    if (authError) { setCriandoEmpresa(false); return Alert.alert('Erro', authError.message); }
    await supabase.from('empresas').insert({ email: emailTratado });
    Alert.alert('Sucesso!', `Empresa cadastrada.`);
    setEmpEmail(''); setEmpSenha(''); carregarEmpresas(); setCriandoEmpresa(false);
  }

  function abrirEdicaoEmpresa(empresa: EmpresaData) { setEmpresaEditando(empresa); setModalEdicaoEmpresaVisivel(true); }

  async function salvarEdicaoEmpresa() {
    if (!empresaEditando) return;
    const valorConvertido = parseFloat(String(empresaEditando.valor_mensalidade).replace(',', '.')) || 0;
    const { error } = await supabase.from('empresas').update({
      status_conta: empresaEditando.status_conta, vencimento: empresaEditando.vencimento, aviso_mural: empresaEditando.aviso_mural, senhas_sistema: empresaEditando.senhas_sistema, valor_mensalidade: valorConvertido
    }).eq('id', empresaEditando.id);
    if (!error) { Alert.alert('Sucesso', 'Atualizado!'); setModalEdicaoEmpresaVisivel(false); carregarEmpresas(); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerPersonalizado}>
        <TouchableOpacity onPress={() => navigation.replace('Login')}><Text style={styles.textoVoltar}>← Sair</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Financeiro')} style={styles.btnFinanceiro}><Text style={styles.textoBtnFinanceiro}>🏢 Caixa Empresa</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Pessoal')} style={[styles.btnFinanceiro, { backgroundColor: '#3b82f6' }]}><Text style={styles.textoBtnFinanceiro}>👤 Meu Bolso</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.aba, abaAtual === 'upload' && styles.abaAtiva]} onPress={() => setAbaAtual('upload')}><Text style={[styles.textoAba, abaAtual === 'upload' && styles.textoAbaAtiva]}>Upload</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'gerenciar' && styles.abaAtiva]} onPress={() => setAbaAtual('gerenciar')}><Text style={[styles.textoAba, abaAtual === 'gerenciar' && styles.textoAbaAtiva]}>Apps</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'empresas' && styles.abaAtiva]} onPress={() => setAbaAtual('empresas')}><Text style={[styles.textoAba, abaAtual === 'empresas' && styles.textoAbaAtiva]}>Empresas</Text></TouchableOpacity>
      </View>

      {abaAtual === 'upload' && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.tituloSecao}>Subir nova atualização</Text>
          <View style={styles.cardAdmin}>
            <Text style={styles.label}>Empresa (Destino do App)</Text>
            <TouchableOpacity style={styles.inputSeletor} onPress={() => setModalUploadEmpresaVisivel(true)}><Text style={styles.textoSeletor}>{upEmpresa}</Text><Text style={styles.iconeSeletor}>▼</Text></TouchableOpacity>
            <Text style={styles.label}>Nome do App</Text>
            <TextInput style={styles.input} placeholder="Ex: Brekaz Vendas" value={upNome} onChangeText={setUpNome} />
            <Text style={styles.label}>Pacote (ID)</Text>
            <TextInput style={styles.input} placeholder="Ex: com.brekaz.vendas" autoCapitalize="none" value={upPacote} onChangeText={setUpPacote} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Versão Texto</Text><TextInput style={styles.input} placeholder="v1.5.0" value={upVersaoTexto} onChangeText={setUpVersaoTexto} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Versão Código</Text><TextInput style={styles.input} placeholder="15" keyboardType="numeric" value={upVersaoCodigo} onChangeText={setUpVersaoCodigo} /></View>
            </View>
            <Text style={styles.label}>Descrição</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={upDescricao} onChangeText={setUpDescricao} />
            <TouchableOpacity style={[styles.botaoAcao, fazendoUpload && styles.botaoDesabilitado]} onPress={selecionarESubirApk} disabled={fazendoUpload}>
              <Text style={styles.textoBotao}>{fazendoUpload ? 'Enviando...' : 'Selecionar APK e Publicar 🚀'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {abaAtual === 'gerenciar' && (
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={styles.tituloSecao}>Sistemas Publicados</Text>
          {carregandoListagem ? <ActivityIndicator size="large" color="#0052cc" /> : (
            <FlatList data={sistemas} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
              <View style={styles.cardItemGerenciar}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.nomeItemLista}>{item.nome} <Text style={{fontSize: 12, color: '#64748b'}}>({item.versao_texto})</Text></Text>
                  
                  {/* NOVO: EXIBIÇÃO DE DOWNLOADS */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, marginBottom: 5 }}>
                    <Text style={{color: '#059669', fontSize: 12, fontWeight: 'bold', marginRight: 10}}>🏢 {item.empresa_vinculada}</Text>
                    <View style={styles.badgeDownload}><Text style={styles.textoBadgeDownload}>📥 {item.qtd_downloads || 0} Instalações</Text></View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => { setAppEditando(item); setModalEdicaoVisivel(true); }}><Text style={{ color: '#0052cc', fontWeight: 'bold' }}>Editar</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => excluirApp(item.id)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Excluir</Text></TouchableOpacity>
                </View>
              </View>
            )}/>
          )}
        </View>
      )}

      {abaAtual === 'empresas' && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          <Text style={styles.tituloSecao}>Cadastrar Nova Empresa</Text>
          <View style={styles.cardAdmin}>
            <Text style={styles.label}>E-mail de Acesso</Text>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={empEmail} onChangeText={setEmpEmail} />
            <Text style={styles.label}>Senha Temporária</Text>
            <TextInput style={styles.input} secureTextEntry value={empSenha} onChangeText={setEmpSenha} />
            <TouchableOpacity style={[styles.botaoAcao, { backgroundColor: '#10b981' }]} onPress={cadastrarNovaEmpresa} disabled={criandoEmpresa}>
              {criandoEmpresa ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBotao}>Criar Acesso</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.divisoria} />
          <Text style={styles.tituloSecao}>Empresas Cadastradas</Text>
          {empresasListaCompleta.map((emp) => (
            <View key={emp.id} style={styles.cardItemGerenciar}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.nomeItemLista}>{emp.email}</Text>
                <Text style={{color: '#475569', fontSize: 13}}>Status: <Text style={{fontWeight: 'bold', color: '#0f172a'}}>{emp.status_conta || 'N/A'}</Text> | R$ {emp.valor_mensalidade || '0.00'}</Text>
              </View>
              <TouchableOpacity onPress={() => abrirEdicaoEmpresa(emp)}><Text style={{ color: '#0052cc', fontWeight: 'bold' }}>Editar</Text></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalEdicaoEmpresaVisivel} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContentScroll}>
            <Text style={styles.tituloSecao}>Dados do Cliente</Text>
            <Text style={{ color: '#059669', fontWeight: 'bold', marginBottom: 15, fontSize: 16 }}>{empresaEditando?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Status da Conta</Text><TextInput style={styles.input} value={empresaEditando?.status_conta} onChangeText={(t) => setEmpresaEditando(p => p ? {...p, status_conta: t} : null)} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Vencimento</Text><TextInput style={styles.input} value={empresaEditando?.vencimento} onChangeText={(t) => setEmpresaEditando(p => p ? {...p, vencimento: t} : null)} /></View>
            </View>
            <Text style={styles.label}>Valor da Mensalidade (R$)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={empresaEditando?.valor_mensalidade?.toString()} onChangeText={(t) => setEmpresaEditando(p => p ? {...p, valor_mensalidade: t} : null)} />
            <Text style={styles.label}>Aviso no Mural do Cliente</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={empresaEditando?.aviso_mural} onChangeText={(t) => setEmpresaEditando(p => p ? {...p, aviso_mural: t} : null)} />
            <Text style={styles.label}>Senhas e Credenciais</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={empresaEditando?.senhas_sistema} onChangeText={(t) => setEmpresaEditando(p => p ? {...p, senhas_sistema: t} : null)} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setModalEdicaoEmpresaVisivel(false)}><Text style={styles.textoBotao}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1, backgroundColor: '#10b981' }]} onPress={salvarEdicaoEmpresa}><Text style={styles.textoBotao}>Salvar</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={modalEdicaoVisivel} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.tituloSecao}>Editando Aplicativo</Text>
            <Text style={styles.label}>Nome do App</Text><TextInput style={styles.input} value={appEditando?.nome} onChangeText={(t) => setAppEditando(p => p ? {...p, nome: t} : null)} />
            <Text style={styles.label}>Versão Textual</Text><TextInput style={styles.input} value={appEditando?.versao_texto} onChangeText={(t) => setAppEditando(p => p ? {...p, versao_texto: t} : null)} />
            <Text style={styles.label}>Empresa Vinculada</Text><TouchableOpacity style={styles.inputSeletor} onPress={() => setModalEditEmpresaVisivel(true)}><Text style={styles.textoSeletor}>{appEditando?.empresa_vinculada}</Text><Text style={styles.iconeSeletor}>▼</Text></TouchableOpacity>
            <Text style={styles.label}>Descrição</Text><TextInput style={[styles.input, { height: 60 }]} multiline value={appEditando?.descricao} onChangeText={(t) => setAppEditando(p => p ? {...p, descricao: t} : null)} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setModalEdicaoVisivel(false)}><Text style={styles.textoBotao}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1 }]} onPress={salvarEdicaoApp}><Text style={styles.textoBotao}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalUploadEmpresaVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlayLista}><View style={styles.modalContentLista}><Text style={styles.tituloSecao}>Selecione a Empresa</Text><FlatList data={empresasCadastradas} keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => (<TouchableOpacity style={styles.itemLista} onPress={() => { setUpEmpresa(item); setModalUploadEmpresaVisivel(false); }}><Text style={styles.textoItemLista}>{item}</Text></TouchableOpacity>)}/><TouchableOpacity style={styles.botaoCancelarLista} onPress={() => setModalUploadEmpresaVisivel(false)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Fechar</Text></TouchableOpacity></View></View>
      </Modal>

      <Modal visible={modalEditEmpresaVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlayLista}><View style={styles.modalContentLista}><Text style={styles.tituloSecao}>Alterar Empresa do App</Text><FlatList data={empresasCadastradas} keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => (<TouchableOpacity style={styles.itemLista} onPress={() => { setAppEditando(p => p ? {...p, empresa_vinculada: item} : null); setModalEditEmpresaVisivel(false); }}><Text style={styles.textoItemLista}>{item}</Text></TouchableOpacity>)}/><TouchableOpacity style={styles.botaoCancelarLista} onPress={() => setModalEditEmpresaVisivel(false)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Fechar</Text></TouchableOpacity></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerPersonalizado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  textoVoltar: { color: '#0052cc', fontWeight: 'bold' },
  btnFinanceiro: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  textoBtnFinanceiro: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  menuAbas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 3, borderColor: '#0052cc' },
  textoAba: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  textoAbaAtiva: { color: '#0052cc', fontWeight: 'bold', fontSize: 13 },
  tituloSecao: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, marginTop: 5 },
  
  // DESIGN PREMIUM DOS CARDS
  cardAdmin: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, borderWidth: 1, borderColor: '#f1f5f9' },
  cardItemGerenciar: { backgroundColor: '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 10, color: '#1e293b' },
  inputSeletor: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textoSeletor: { fontSize: 15, color: '#1e293b' },
  iconeSeletor: { fontSize: 12, color: '#64748b' },
  botaoAcao: { backgroundColor: '#0052cc', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  botaoDesabilitado: { backgroundColor: '#94a3b8' },
  textoBotao: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  nomeItemLista: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  
  // BADGE DOWNLOADS
  badgeDownload: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  textoBadgeDownload: { color: '#1d4ed8', fontSize: 11, fontWeight: 'bold' },

  divisoria: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 25 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20 },
  modalContentScroll: { backgroundColor: '#fff', padding: 25, borderRadius: 20, paddingBottom: 40 },
  modalOverlayLista: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContentLista: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, maxHeight: '60%' },
  itemLista: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  textoItemLista: { fontSize: 17, color: '#1e293b', fontWeight: '500' },
  botaoCancelarLista: { marginTop: 20, alignItems: 'center', paddingVertical: 12, backgroundColor: '#fef2f2', borderRadius: 10 }
});